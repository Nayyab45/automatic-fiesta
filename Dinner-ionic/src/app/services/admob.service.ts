import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  type AdMobBannerSize,
  type BannerAdOptions,
} from '@capacitor-community/admob';
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

// The banner is a native view drawn on top of the WebView, not a DOM
// element -- nothing in the page layout knows it's there unless told. Every
// screen's sticky/fixed top-anchored bar (header, root header, offline/push
// banners) reads this CSS var via Tailwind's top-[var(--ad-offset,0px)] /
// mt-[var(--ad-offset,0px)] to sit below the banner instead of under it.
const AD_OFFSET_VAR = '--ad-offset';
const AD_GAP_PX = 8;

// Native-only -- there's no ad SDK to initialize on the plain web build
// (`ng serve`).
@Injectable({ providedIn: 'root' })
export class AdmobService {
  private readonly subscriptionService = inject(SubscriptionService);

  private initialized = false;
  private bannerShowing = false;

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
    });

    // The banner's actual rendered height (adaptive, varies by device
    // width) -- only known once Google actually sizes/loads a creative, so
    // screens sit flush (offset 0) until this fires once, then shift down.
    await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      if (this.bannerShowing) this.setOffset(size.height + AD_GAP_PX);
    });

    this.showBanner();
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
    } else if (!this.bannerShowing) {
      this.showBanner();
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

  private hideBanner(): void {
    if (!this.bannerShowing) return;
    this.bannerShowing = false;
    this.setOffset(0);
    AdMob.hideBanner().catch(() => {});
  }

  private setOffset(px: number): void {
    document.documentElement.style.setProperty(AD_OFFSET_VAR, `${px}px`);
  }
}
