import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  type AdMobBannerSize,
  type AdOptions,
  type BannerAdOptions,
} from '@capacitor-community/admob';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SubscriptionService } from './subscription.service';

// adId/isTesting come from environment.ts (dev) / environment.prod.ts (prod
// release build) rather than being hardcoded here, so swapping in the app's
// real AdMob banner unit id for a Play Store release is a one-line edit to
// environment.prod.ts -- see its comment -- not a code change. The App ID
// (a separate id, native-side) is the AndroidManifest.xml meta-data instead;
// see android/app/admob.properties.example for that one.
const BANNER_OPTIONS: BannerAdOptions = {
  adId: environment.adMob.bannerAdUnitId,
  adSize: BannerAdSize.ADAPTIVE_BANNER,
  position: BannerAdPosition.TOP_CENTER,
  isTesting: environment.adMob.isTesting,
};

// Selector for each screen's own header bar (see HeaderComponent and
// RootHeaderComponent, plus the handful of pages that inline their own).
// The banner is pinned right under whichever one is currently on screen.
const PAGE_HEADER_SELECTOR = 'header.ad-header';

const INTERSTITIAL_OPTIONS: AdOptions = {
  adId: environment.adMob.interstitialAdUnitId,
  isTesting: environment.adMob.isTesting,
};

// Minimum gap between full-screen ads, also counted from app start so one
// never greets a user who just opened the app. Interstitials are only ever
// triggered from natural breaks (see showInterstitial's callers), never
// from safety/check-in flows or in response to a tap on a control.
const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;

const BANNER_RETRY_BASE_MS = 15_000;
const BANNER_RETRY_MAX_MS = 120_000;
const BANNER_MAX_RETRIES = 8;

// The banner is a native view drawn on top of the WebView, not a DOM
// element -- nothing in the page layout knows it's there unless told. It
// sits directly UNDER the page header, so every header leaves this much
// space below itself (Tailwind's mb-[var(--ad-offset,0px)]) for the banner
// to occupy, instead of the content running underneath it.
const AD_OFFSET_VAR = '--ad-offset';
// Same space plus the status bar, for screens that have no header to hold it.
const AD_PAGE_OFFSET_VAR = '--ad-page-offset';
const AD_GAP_PX = 8;

// Re-measure the header this long after a navigation settles (page transition
// finished) and once more after data has had time to render.
const BANNER_SYNC_DELAYS_MS = [400, 1200];
// Only re-create the native banner (a fresh ad request) when the header's
// height actually changed by more than this, so ordinary navigation between
// same-height screens never reloads the ad.
const BANNER_MARGIN_TOLERANCE_PX = 3;
const BANNER_POSITION_POLL_MS = 1000;
// How long to let the plugin finish destroying a removed banner before a new
// one is requested (see recreateBanner).
const BANNER_REMOVE_SETTLE_MS = 400;

// An interstitial this long after opening a chat (group or DM), once per
// visit. If the user is mid-message it waits (up to the limit below) rather
// than cutting in on what they're typing.
const CHAT_AD_DELAY_MS = 30_000;
const CHAT_AD_RECHECK_MS = 10_000;
const CHAT_AD_MAX_POSTPONES = 3;
const CHAT_ROUTE = /^\/dining-group-chat\/.+/;

// Native-only -- there's no ad SDK to initialize on the plain web build
// (`ng serve`).
@Injectable({ providedIn: 'root' })
export class AdmobService {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly router = inject(Router);

  private initialized = false;
  private bannerShowing = false;
  private bannerRecreating = false;
  private bannerMargin = 0;
  private lastMeasuredMargin = 0;
  private bannerSyncTimers: ReturnType<typeof setTimeout>[] = [];
  private chatTimer: ReturnType<typeof setTimeout> | null = null;
  private chatPostpones = 0;
  private bannerRetries = 0;
  private bannerRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private interstitialReady = false;
  private interstitialLoading = false;
  private lastInterstitialAt = Date.now();

  constructor() {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.onNavigated(e.urlAfterRedirects);
    });
  }

  private get adsRemoved(): boolean {
    return this.subscriptionService.adsRemoved();
  }

  async init(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) return;
    this.initialized = true;
    await AdMob.initialize({ testingDevices: [], initializeForTesting: environment.adMob.isTesting });

    // showBanner() resolving only means the native banner *container* was
    // created -- it says nothing about whether an ad creative actually
    // loaded into it. Without this, bannerShowing stays true after a "no
    // fill" response (a real, fairly common outcome for a test ad unit),
    // permanently blocking showBanner() from ever retrying.
    await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
      this.bannerShowing = false;
      this.setOffset(0);
      this.scheduleBannerRetry();
    });
    await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
      this.bannerRetries = 0;
    });

    // The banner's actual rendered height (adaptive, varies by device
    // width) -- only known once Google actually sizes/loads a creative, so
    // screens sit flush (offset 0) until this fires once, then shift down.
    await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      // height 0 = the banner was removed (e.g. being re-created at a new
      // position), so don't leave a gap for something that isn't there.
      if (this.bannerShowing) this.setOffset(size.height > 0 ? size.height + AD_GAP_PX : 0);
    });

    // Loaded/failed only matter for the *next* showInterstitial() call. After
    // an ad is dismissed (or fails to show) a fresh one is preloaded so the
    // next natural break has one ready instead of waiting on a network load.
    await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
      this.interstitialLoading = false;
      this.interstitialReady = true;
    });
    await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
      this.interstitialLoading = false;
      this.interstitialReady = false;
    });
    await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      this.interstitialReady = false;
      this.lastInterstitialAt = Date.now();
      this.prepareInterstitial();
      this.recreateBanner();
    });
    await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => {
      this.interstitialReady = false;
      this.prepareInterstitial();
      this.recreateBanner();
    });

    this.bannerMargin = this.measureBannerMargin();
    this.lastMeasuredMargin = this.bannerMargin;
    this.showBanner();
    this.prepareInterstitial();
    this.onNavigated(this.router.url);

    // The two one-off re-measures after a navigation can both land before the
    // new page's header has rendered (e.g. right after login, while data is
    // still loading), leaving the banner on top of it for good. Keep checking.
    setInterval(() => {
      if (document.visibilityState === 'visible') this.syncBannerPosition();
    }, BANNER_POSITION_POLL_MS);
  }

  /** Shows a full-screen ad if one is preloaded, the user isn't ad-free, and
   * the cooldown has elapsed -- otherwise silently does nothing, so callers
   * can invoke it at a natural break without checking anything themselves.
   * Never awaited by callers: an ad must not delay or block navigation. */
  showInterstitial(options: { ignoreCooldown?: boolean } = {}): void {
    if (!this.initialized || this.adsRemoved || !this.interstitialReady) return;
    if (!options.ignoreCooldown && Date.now() - this.lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return;
    this.interstitialReady = false;
    AdMob.showInterstitial().catch(() => this.prepareInterstitial());
  }

  /** Called right after a purchase/restore completes (see PricingPage) --
   * SubscriptionService's own signal is already updated by then, this just
   * acts on it: hides the banner immediately for a newly ad-free tier or Remove ads plan, or
   * shows it again if a subscription lapsed, without waiting for the next
   * natural showBanner() call. */
  refresh(): void {
    if (!this.initialized) return;
    if (this.adsRemoved) {
      this.hideBanner();
    } else {
      if (!this.bannerShowing) this.showBanner();
      this.prepareInterstitial();
    }
  }

  // Deliberately no dismiss()/close button: the Free tier's ad is
  // permanent, not just default-on -- closing it would let a Free user get
  // the ad-free experience without upgrading, undercutting the one perk
  // that's supposed to be exclusive to Basic and above. See lib/tiers.js's
  // noAds flag for the one real way to remove it.

  private showBanner(): void {
    if (this.bannerShowing || !this.initialized || this.adsRemoved) return;
    this.bannerShowing = true;
    AdMob.showBanner({ ...BANNER_OPTIONS, margin: this.bannerMargin }).catch(() => {
      this.bannerShowing = false;
    });
  }

  // A failed banner load (very common for a brand-new ad unit, which can
  // take a while to start filling) otherwise leaves the screen without an
  // ad until some unrelated refresh() call. Retries with a growing delay,
  // capped, and resets as soon as one loads.
  private scheduleBannerRetry(): void {
    if (this.bannerRetryTimer || this.bannerRetries >= BANNER_MAX_RETRIES) return;
    const delay = Math.min(BANNER_RETRY_BASE_MS * 2 ** this.bannerRetries, BANNER_RETRY_MAX_MS);
    this.bannerRetries++;
    this.bannerRetryTimer = setTimeout(() => {
      this.bannerRetryTimer = null;
      this.showBanner();
    }, delay);
  }

  private onNavigated(url: string): void {
    this.bannerSyncTimers.forEach(clearTimeout);
    this.bannerSyncTimers = BANNER_SYNC_DELAYS_MS.map((ms) => setTimeout(() => this.syncBannerPosition(), ms));

    if (CHAT_ROUTE.test(url.split('?')[0])) {
      this.startChatTimer();
    } else {
      this.cancelChatTimer();
    }
  }

  // The status-bar height as the page sees it, in CSS px (= dp on Android).
  // The AdMob plugin adds the real system inset to the banner's top margin by
  // itself on Android 15+ (where the WebView draws behind the status bar),
  // and on older Android the content already starts below the bar -- so the
  // margin to pass is only the header's own height beyond that inset.
  private statusInsetPx(): number {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;padding-top:env(safe-area-inset-top, 7777px)';
    document.body.appendChild(probe);
    const value = parseFloat(getComputedStyle(probe).paddingTop);
    probe.remove();
    return Number.isFinite(value) && value < 7777 ? value : 0;
  }

  /** Margin (dp, below the status bar) that puts the banner just under the
   * page header currently on screen; 0 for screens with no header (login,
   * welcome, ...), where it simply sits under the status bar. */
  private measureBannerMargin(): number {
    // ion-router-outlet keeps previously visited pages in the DOM, hidden --
    // only the visible one has a real height.
    const visible = Array.from(document.querySelectorAll<HTMLElement>(PAGE_HEADER_SELECTOR)).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.width > 0;
    });
    const header = visible[visible.length - 1];
    if (!header) return 0;
    return Math.max(0, Math.round(header.getBoundingClientRect().bottom - this.statusInsetPx()));
  }

  private syncBannerPosition(): void {
    if (!this.initialized) return;
    const next = this.measureBannerMargin();
    // Only act on a reading seen twice in a row, so a header caught mid page
    // transition doesn't trigger a pointless rebuild (= a fresh ad request).
    const stable = Math.abs(next - this.lastMeasuredMargin) < BANNER_MARGIN_TOLERANCE_PX;
    this.lastMeasuredMargin = next;
    if (!stable || Math.abs(next - this.bannerMargin) < BANNER_MARGIN_TOLERANCE_PX) return;
    this.bannerMargin = next;
    // The plugin has no "move" call: re-create the banner at the new margin.
    this.recreateBanner();
  }

  // A full-screen ad takes over the activity and the native banner view
  // doesn't reliably come back after it closes (it's left hidden or torn
  // down while bannerShowing still says true, so showBanner() would never
  // run again) -- so after one, and when the header moved, rebuild it.
  //
  // removeBanner() resolves before the plugin has actually torn the old view
  // down (that's posted to the UI thread). Calling showBanner() straight away
  // lands on the plugin's "update the existing banner" path, and the queued
  // teardown then destroys it -- leaving no banner at all. So wait for it.
  private recreateBanner(): void {
    if (!this.initialized || !this.bannerShowing || this.bannerRecreating || this.adsRemoved) return;
    this.bannerRecreating = true;
    AdMob.removeBanner()
      .catch(() => {})
      .finally(() => {
        setTimeout(() => {
          this.bannerRecreating = false;
          this.bannerShowing = false;
          this.bannerMargin = this.measureBannerMargin();
          this.showBanner();
        }, BANNER_REMOVE_SETTLE_MS);
      });
  }

  private startChatTimer(): void {
    this.cancelChatTimer();
    this.chatPostpones = 0;
    this.chatTimer = setTimeout(() => this.chatAdDue(), CHAT_AD_DELAY_MS);
  }

  private cancelChatTimer(): void {
    if (this.chatTimer) clearTimeout(this.chatTimer);
    this.chatTimer = null;
  }

  private chatAdDue(): void {
    this.chatTimer = null;
    const hidden = document.visibilityState !== 'visible';
    if (hidden || (this.userIsTyping() && this.chatPostpones < CHAT_AD_MAX_POSTPONES)) {
      if (!hidden) this.chatPostpones++;
      this.chatTimer = setTimeout(() => this.chatAdDue(), CHAT_AD_RECHECK_MS);
      return;
    }
    this.showInterstitial({ ignoreCooldown: true });
  }

  private userIsTyping(): boolean {
    const el = document.activeElement;
    return (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) && el.value.trim().length > 0;
  }

  private prepareInterstitial(): void {
    if (this.interstitialReady || this.interstitialLoading || !this.initialized || this.adsRemoved) return;
    this.interstitialLoading = true;
    AdMob.prepareInterstitial(INTERSTITIAL_OPTIONS).catch(() => {
      this.interstitialLoading = false;
    });
  }

  private hideBanner(): void {
    if (!this.bannerShowing) return;
    this.bannerShowing = false;
    this.setOffset(0);
    AdMob.hideBanner().catch(() => {});
  }

  private setOffset(px: number): void {
    document.documentElement.style.setProperty(AD_OFFSET_VAR, `${px}px`);
    document.documentElement.style.setProperty(
      AD_PAGE_OFFSET_VAR,
      px > 0 ? `calc(env(safe-area-inset-top, 0px) + ${px}px)` : '0px',
    );
  }
}
