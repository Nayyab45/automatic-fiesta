import { Injectable, effect, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdPosition, BannerAdSize, type BannerAdOptions } from '@capacitor-community/admob';
import { AuthService } from './auth.service';
import { PaymentService } from './payment.service';

// Google's official public TEST banner unit id -- always serves a clearly
// labeled "Test Ad", never a real one, so it's safe to ship before the
// app's own AdMob account/ad units exist. Swap for the real banner ad unit
// id from admob.google.com (and the App ID in AndroidManifest.xml) before a
// production release -- see that file's comment.
const TEST_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

const BANNER_OPTIONS: BannerAdOptions = {
  adId: TEST_BANNER_AD_UNIT_ID,
  adSize: BannerAdSize.ADAPTIVE_BANNER,
  position: BannerAdPosition.BOTTOM_CENTER,
  // Room for BottomNavComponent's own bar so the ad doesn't sit on top of
  // its tap targets.
  margin: 56,
  isTesting: true,
};

// Free-tier-only banner ads (see proposal: "Free Version ... Google AdMob
// advertisements" / "Premium ... No advertisements"). Native-only -- there's
// no ad SDK to initialize on the plain web build (`ng serve`).
@Injectable({ providedIn: 'root' })
export class AdmobService {
  private readonly authService = inject(AuthService);
  private readonly paymentService = inject(PaymentService);

  private initialized = false;
  private bannerShowing = false;

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
        next: ({ subscription }) => {
          if (subscription.status === 'active') this.hideBanner();
          else this.showBanner();
        },
        error: () => {},
      });
    });
  }

  async init(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) return;
    this.initialized = true;
    await AdMob.initialize({ testingDevices: [], initializeForTesting: true });
  }

  /** Call again after a checkout succeeds, so the banner disappears immediately
   * instead of waiting for the next sign-in-state change to re-check it. */
  refresh(): void {
    this.paymentService.getSubscription().subscribe({
      next: ({ subscription }) => (subscription.status === 'active' ? this.hideBanner() : this.showBanner()),
      error: () => {},
    });
  }

  private showBanner(): void {
    if (this.bannerShowing || !this.initialized) return;
    this.bannerShowing = true;
    AdMob.showBanner(BANNER_OPTIONS).catch(() => (this.bannerShowing = false));
  }

  private hideBanner(): void {
    if (!this.bannerShowing) return;
    this.bannerShowing = false;
    AdMob.hideBanner().catch(() => {});
  }
}
