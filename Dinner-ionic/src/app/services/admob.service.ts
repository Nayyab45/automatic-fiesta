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
//
// The banner sits at the very bottom of the screen, directly BELOW the bottom
// navigation bar. (On Android 15+ the plugin lifts it above the system
// navigation bar by itself.)
const BANNER_OPTIONS: BannerAdOptions = {
  adId: environment.adMob.bannerAdUnitId,
  adSize: BannerAdSize.ADAPTIVE_BANNER,
  position: BannerAdPosition.BOTTOM_CENTER,
  margin: 0,
  isTesting: environment.adMob.isTesting,
};

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
// element -- nothing in the page layout knows it's there unless told. Once its
// height is known these CSS variables (see global.scss) make every screen make
// room for it:
//  * --ad-bottom-offset: the space the banner occupies at the bottom, system
//    inset included. Each page leaves it free, and anything pinned to the
//    bottom of the screen (the tab bar, sticky action bars) sits above it.
//  * --ad-safe-bottom: the bottom padding .pb-safe uses -- 0 while the banner
//    is up, since the banner already covers the system inset.
const AD_OFFSET_VAR = '--ad-bottom-offset';
const AD_SAFE_BOTTOM_VAR = '--ad-safe-bottom';

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
      // height 0 = the banner was removed. While it's being re-created that's
      // momentary, so keep the space reserved rather than making every screen
      // jump up and back down.
      if (!this.bannerShowing || (size.height === 0 && this.bannerRecreating)) return;
      this.setOffset(size.height);
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

    this.showBanner();
    this.prepareInterstitial();
    this.onNavigated(this.router.url);
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
    AdMob.showBanner(BANNER_OPTIONS).catch(() => {
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
    if (CHAT_ROUTE.test(url.split('?')[0])) {
      this.startChatTimer();
    } else {
      this.cancelChatTimer();
    }
  }

  // A full-screen ad takes over the activity and the native banner view
  // doesn't reliably come back after it closes (it's left hidden or torn
  // down while bannerShowing still says true, so showBanner() would never
  // run again) -- so after one, rebuild it.
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
    const root = document.documentElement.style;
    if (px > 0) {
      root.setProperty(AD_OFFSET_VAR, `calc(env(safe-area-inset-bottom, 0px) + ${px}px)`);
      root.setProperty(AD_SAFE_BOTTOM_VAR, '0px');
    } else {
      root.removeProperty(AD_OFFSET_VAR);
      root.removeProperty(AD_SAFE_BOTTOM_VAR);
    }
  }
}
