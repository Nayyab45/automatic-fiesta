import { Injectable, effect, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdPluginEvents, BannerAdPosition, BannerAdSize, type BannerAdOptions } from '@capacitor-community/admob';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { PaymentService } from './payment.service';

// adId/isTesting come from environment.ts (dev) / environment.prod.ts (prod
// release build) rather than being hardcoded here, so swapping in the app's
// real AdMob banner unit id for a Play Store release is a one-line edit to
// environment.prod.ts -- see its comment -- not a code change. The App ID
// (a separate id, native-side) is the AndroidManifest.xml meta-data instead;
// see android/app/admob.properties.example for that one.
const BANNER_OPTIONS: BannerAdOptions = {
  adId: environment.adMob.bannerAdUnitId,
  adSize: BannerAdSize.ADAPTIVE_BANNER,
  position: BannerAdPosition.BOTTOM_CENTER,
  // Room for BottomNavComponent's own bar so the ad doesn't sit on top of
  // its tap targets.
  margin: 56,
  isTesting: environment.adMob.isTesting,
};

// Banner ads for accounts without Premium (see proposal: "Free Version ...
// Google AdMob advertisements" / "Premium ... No advertisements"). While every
// Premium feature is free for everyone (the server default, see
// PaymentService.premiumFeaturesFree) nobody qualifies, so no ad is shown --
// turning the paid gating back on on the server brings ads back for free
// accounts with no app change. Native-only -- there's no ad SDK to initialize
// on the plain web build (`ng serve`).
@Injectable({ providedIn: 'root' })
export class AdmobService {
  private readonly authService = inject(AuthService);
  private readonly paymentService = inject(PaymentService);

  private initialized = false;
  private bannerShowing = false;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  /** True while the native banner is actually on screen -- drives the
   * floating close button in AppComponent (there's nothing to close
   * otherwise). Not affected by a pending dismiss timer's eventual re-show. */
  readonly bannerVisible = signal(false);

  constructor() {
    // Re-checks premium status (and shows/hides the banner accordingly)
    // every time sign-in state changes -- covers logging in as a premium
    // account, logging out, and switching accounts on the same device.
    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.hideBanner();
        return;
      }
      this.paymentService.getSubscription().subscribe({
        // "No advertisements" is a Premium perk -- and with every Premium
        // feature free for everyone, nobody sees ads.
        next: ({ subscription, premiumFeaturesFree }) => {
          if (premiumFeaturesFree || subscription.status === 'active') this.hideBanner();
          else this.showBanner();
        },
        error: () => {},
      });
    });
  }

  async init(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) return;
    this.initialized = true;
    await AdMob.initialize({ testingDevices: [], initializeForTesting: environment.adMob.isTesting });

    // showBanner() resolving only means the native banner *container* was
    // created -- it says nothing about whether an ad creative actually
    // loaded into it. Without these, a "no fill" response (a real, fairly
    // common outcome for a test ad unit) left bannerVisible true and the
    // close button floating over an empty banner with nothing to close.
    await AdMob.addListener(BannerAdPluginEvents.Loaded, () => this.bannerVisible.set(true));
    await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
      // Let a later showBanner() (next auth/subscription check, or the
      // dismiss() retry) try again instead of staying stuck believing a
      // banner is showing when nothing ever loaded.
      this.bannerShowing = false;
      this.bannerVisible.set(false);
    });
  }

  /** Call again after a checkout succeeds, so the banner disappears immediately
   * instead of waiting for the next sign-in-state change to re-check it. */
  refresh(): void {
    this.paymentService.getSubscription().subscribe({
      next: ({ subscription, premiumFeaturesFree }) =>
        premiumFeaturesFree || subscription.status === 'active' ? this.hideBanner() : this.showBanner(),
      error: () => {},
    });
  }

  /** Hides the banner for 15s, then re-checks eligibility and shows it again
   * if it's still earned (still free-tier, still signed in) -- lets a user
   * reclaim the screen briefly without permanently losing the ad slot. */
  dismiss(): void {
    if (this.dismissTimer || !this.bannerShowing) return;
    this.hideBanner();
    this.dismissTimer = setTimeout(() => {
      this.dismissTimer = null;
      this.refresh();
    }, 15000);
  }

  private showBanner(): void {
    if (this.bannerShowing || !this.initialized) return;
    this.bannerShowing = true;
    // bannerVisible flips true only once the Loaded event actually fires
    // (see init()) -- not here, since a resolved promise doesn't mean an ad
    // creative loaded.
    AdMob.showBanner(BANNER_OPTIONS).catch(() => {
      this.bannerShowing = false;
    });
  }

  private hideBanner(): void {
    this.bannerVisible.set(false);
    if (!this.bannerShowing) return;
    this.bannerShowing = false;
    AdMob.hideBanner().catch(() => {});
  }
}
