import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdPluginEvents, BannerAdPosition, BannerAdSize, type BannerAdOptions } from '@capacitor-community/admob';
import { environment } from '../../environments/environment';

// adId/isTesting come from environment.ts (dev) / environment.prod.ts (prod
// release build) rather than being hardcoded here, so swapping in the app's
// real AdMob banner unit id for a Play Store release is a one-line edit to
// environment.prod.ts -- see its comment -- not a code change. The App ID
// (a separate id, native-side) is the AndroidManifest.xml meta-data instead;
// see android/app/admob.properties.example for that one.
const RESHOW_DELAY_MS = 5000;

const BANNER_OPTIONS: BannerAdOptions = {
  adId: environment.adMob.bannerAdUnitId,
  adSize: BannerAdSize.ADAPTIVE_BANNER,
  position: BannerAdPosition.BOTTOM_CENTER,
  // Room for BottomNavComponent's own bar so the ad doesn't sit on top of
  // its tap targets.
  margin: 56,
  isTesting: environment.adMob.isTesting,
};

// Native-only -- there's no ad SDK to initialize on the plain web build
// (`ng serve`).
@Injectable({ providedIn: 'root' })
export class AdmobService {
  private initialized = false;
  private bannerShowing = false;
  private reshowTimeout: ReturnType<typeof setTimeout> | null = null;

  /** True while the native banner is actually on screen -- drives the
   * floating close button in AppComponent (there's nothing to close
   * otherwise). */
  readonly bannerVisible = signal(false);

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
      this.bannerShowing = false;
      this.bannerVisible.set(false);
    });

    this.showBanner();
  }

  /** Closes the banner from its floating close button -- not for good,
   * though: it reappears RESHOW_DELAY_MS later rather than staying
   * dismissed for the rest of the session, same as the person would see it
   * again on the next screen anyway. */
  dismiss(): void {
    this.hideBanner();
    if (this.reshowTimeout) clearTimeout(this.reshowTimeout);
    this.reshowTimeout = setTimeout(() => {
      this.reshowTimeout = null;
      this.showBanner();
    }, RESHOW_DELAY_MS);
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
