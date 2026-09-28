import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SubscriptionService } from './subscription.service';

// cordova-plugin-purchase ships as a Cordova (not npm/ESM) plugin: `npx cap
// sync android` copies its native Android code into the project AND injects
// its www/store.js bridge into the WebView's own script bundle (see its
// plugin.xml's <js-module name="CdvPurchase">) -- it is never imported from
// 'cordova-plugin-purchase' here, only ever referenced as this ambient
// global once the native shell has loaded it. On the plain web build
// (`ng serve`) this global never appears at all, matching every other
// native-only integration in this app (see AdmobService). Untyped (`any`)
// throughout this file rather than importing the plugin's own .d.ts: its
// types describe an ambient global namespace, not an ES module, and the
// runtime object handed to each callback is the real platform-specific
// subclass (GooglePlay.Transaction etc.) regardless of what the base-class
// type says.
declare const CdvPurchase: any;

export const PLAY_PRODUCT_IDS = ['weeat_basic_monthly', 'weeat_standard_monthly', 'weeat_premium_monthly'] as const;
export type PlayProductId = (typeof PLAY_PRODUCT_IDS)[number];

export interface BillingProduct {
  id: string;
  /** Localized, store-quoted price (e.g. "PKR 500.00") -- only populated
   * once the Play Store responds; the pricing page falls back to the
   * backend's plain pricePkr number until then. */
  priceString: string | null;
}

interface PendingPurchase {
  productId: string;
  resolve: () => void;
  reject: (err: unknown) => void;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly subscriptionService = inject(SubscriptionService);

  private store: any = null;
  private initPromise: Promise<void> | null = null;
  private pendingPurchase: PendingPurchase | null = null;

  readonly products = signal<BillingProduct[]>([]);
  readonly purchasing = signal<PlayProductId | null>(null);
  readonly lastError = signal<string | null>(null);

  /** Safe to call more than once (e.g. app start + arriving on the pricing
   * page) -- only the first call actually registers/initializes the store. */
  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (!this.initPromise) {
      this.initPromise = this.doInit();
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (typeof CdvPurchase === 'undefined') {
      // Plugin bridge not present -- most likely `npx cap sync android`
      // hasn't been run since installing cordova-plugin-purchase. Fails
      // quiet rather than throwing, same as AdmobService's ad failures: a
      // broken purchase flow shouldn't take the rest of the app down with it.
      this.lastError.set('Billing is not available on this build.');
      return;
    }

    const { store, ProductType, Platform } = CdvPurchase;
    this.store = store;

    store.register(
      PLAY_PRODUCT_IDS.map((id) => ({ id, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY })),
    );

    // Deliberately NOT using store.validator/transaction.verify() -- that
    // flow expects a specific server response payload (a Google Play
    // "NativeTransaction" shape) mirroring what the plugin's own paid
    // receipt-validation service returns, which isn't what this app's own
    // backend produces. Instead, every approved transaction is verified
    // against OUR backend directly (which itself calls the real Google Play
    // Developer API -- see Backend/src/lib/googlePlay.js) and finished
    // manually once that succeeds. Registered once here, not per-purchase:
    // this also fires for a transaction Play Store surfaces as still
    // unfinished from a previous session (e.g. the app was killed right
    // after a purchase, before finish() ran), which is exactly what
    // restore() below relies on.
    store.when().approved((transaction: any) => this.handleApproved(transaction));

    store.when().productUpdated(() => {
      this.products.set(
        (store.products ?? []).map((p: any) => ({ id: p.id, priceString: p.pricing?.price ?? null })),
      );
    });

    store.error((err: any) => {
      this.lastError.set(err?.message ?? 'Billing error');
      this.pendingPurchase?.reject(new Error(err?.message ?? 'Purchase failed'));
      this.pendingPurchase = null;
      this.purchasing.set(null);
    });

    await store.initialize([Platform.GOOGLE_PLAY]);
  }

  private handleApproved(transaction: any): void {
    const productId: string | undefined = transaction.products?.[0]?.id;
    // Android's purchase token lives on the receipt, not the transaction
    // itself -- parentReceipt is the documented path (GooglePlay.Receipt);
    // nativePurchase is the underlying Billing Library object, kept as a
    // fallback in case a plugin version moves it.
    const purchaseToken: string | undefined =
      transaction.parentReceipt?.purchaseToken ?? transaction.nativePurchase?.purchaseToken;

    if (!productId || !purchaseToken) {
      this.lastError.set('Purchase is missing required data.');
      this.pendingPurchase?.reject(new Error('Purchase is missing required data.'));
      this.pendingPurchase = null;
      return;
    }

    this.subscriptionService.verify(productId, purchaseToken).subscribe({
      next: async () => {
        await transaction.finish();
        if (this.pendingPurchase?.productId === productId) {
          this.pendingPurchase.resolve();
          this.pendingPurchase = null;
        }
      },
      error: (err) => {
        const message = err?.error?.message ?? 'Verification failed';
        this.lastError.set(message);
        if (this.pendingPurchase?.productId === productId) {
          this.pendingPurchase.reject(new Error(message));
          this.pendingPurchase = null;
        }
        // Deliberately not finished -- an unverified purchase should stay
        // pending so the next restore()/app start retries verification,
        // rather than being silently dropped.
      },
    });
  }

  /** Launches Google's own purchase sheet for a tier's monthly subscription.
   * Resolves once the purchase is approved, verified by our backend, and
   * finished, or rejects on error/cancel. The actual tier change is
   * reflected via SubscriptionService (updated inside handleApproved above)
   * before this resolves. */
  async purchase(productId: PlayProductId): Promise<void> {
    if (!this.store) {
      throw new Error('Billing is not initialized yet.');
    }
    const offer = this.store.get(productId)?.getOffer();
    if (!offer) {
      throw new Error('This plan is not available for purchase right now. Try again shortly.');
    }

    this.purchasing.set(productId);
    this.lastError.set(null);
    try {
      await new Promise<void>((resolve, reject) => {
        this.pendingPurchase = { productId, resolve, reject };
        this.store.order(offer).catch((err: unknown) => {
          this.pendingPurchase = null;
          reject(err);
        });
      });
    } finally {
      this.purchasing.set(null);
    }
  }

  /** Re-queries Google Play for any purchase already on file for this
   * Google account (reinstall, new device, or a purchase whose finish()
   * never ran, e.g. the app was killed right after buying) -- Play Store
   * policy requires apps with subscriptions to offer this. Any purchase it
   * surfaces re-fires the same `approved` handler registered in doInit(),
   * which verifies it against our backend and updates SubscriptionService. */
  async restore(): Promise<void> {
    if (!this.store) return;
    await this.store.restorePurchases();
  }
}
