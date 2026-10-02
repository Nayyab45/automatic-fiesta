import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export type TierId = 'free' | 'basic' | 'standard' | 'premium';

export interface TierFeatures {
  noAds: boolean;
  monthlyTableLimit: number | null; // null means unlimited, see unlimitedTables
  unlimitedTables: boolean;
  advancedFilters: boolean;
  profileViewers: boolean;
  aiInsights: boolean;
  priorityPlacement: boolean;
}

export interface Tier {
  id: TierId;
  name: string;
  pricePkr: number;
  playProductId: string | null;
  features: TierFeatures;
}

export interface Subscription {
  tier: TierId;
  status: 'inactive' | 'active' | 'canceled' | 'grace_period' | 'on_hold' | 'expired';
  currentPeriodEnd: string | null;
  autoRenewing: boolean;
}

export type AdRemovalBasePlan = 'monthly' | 'yearly';

/** The standalone "Remove ads" add-on -- billed separately from the tiers
 * above (see Backend migration 0039), so it has its own state. */
export interface AdRemoval {
  basePlan: AdRemovalBasePlan | null;
  status: Subscription['status'];
  currentPeriodEnd: string | null;
  autoRenewing: boolean;
}

export interface AdRemovalPlan {
  basePlanId: AdRemovalBasePlan;
  pricePkr: number;
  period: 'month' | 'year';
}

export interface AdRemovalPlans {
  productId: string;
  plans: AdRemovalPlan[];
}

const NO_AD_REMOVAL: AdRemoval = { basePlan: null, status: 'inactive', currentPeriodEnd: null, autoRenewing: false };

const FREE_SUBSCRIPTION: Subscription = { tier: 'free', status: 'inactive', currentPeriodEnd: null, autoRenewing: false };

// Single source of truth for "what tier is this account on right now" --
// AdmobService, the pricing page, and any feature-gated screen all read
// this instead of calling the backend themselves, so a purchase anywhere in
// the app is reflected everywhere else without a page reload.
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/subscriptions`;

  private readonly subscriptionSignal = signal<Subscription>(FREE_SUBSCRIPTION);
  readonly subscription = this.subscriptionSignal.asReadonly();
  readonly isActive = computed(() => ['active', 'grace_period'].includes(this.subscriptionSignal().status));
  // The tier actually in effect right now -- mirrors the backend's
  // tierFor() (subscriptions.js): a stored tier only counts while its
  // status is active/grace_period, otherwise every feature check below
  // falls back to Free, same as server-side gating would.
  readonly tier = computed<TierId>(() => (this.isActive() ? this.subscriptionSignal().tier : 'free'));

  private readonly adRemovalSignal = signal<AdRemoval>(NO_AD_REMOVAL);
  readonly adRemoval = this.adRemovalSignal.asReadonly();
  readonly adRemovalActive = computed(() => ['active', 'grace_period'].includes(this.adRemovalSignal().status));

  private readonly adRemovalPlansSignal = signal<AdRemovalPlans | null>(null);
  readonly adRemovalPlans = this.adRemovalPlansSignal.asReadonly();

  private readonly tiersSignal = signal<Tier[]>([]);
  readonly tiers = this.tiersSignal.asReadonly();
  private readonly featuresByTier = computed(() => new Map(this.tiersSignal().map((tier) => [tier.id, tier.features])));

  /** Ads are gone for a tier that includes noAds OR an active Remove ads
   * add-on, whichever the account has. */
  readonly adsRemoved = computed(() => this.adRemovalActive() || this.hasFeature('noAds'));

  hasFeature(feature: keyof TierFeatures): boolean {
    const features = this.featuresByTier().get(this.tier());
    return features ? !!features[feature] : false;
  }

  private loaded = false;

  /** Awaited once after login/app start so gated UI (ads, upsell banners)
   * reflects the real plan from the first render instead of assuming Free. */
  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    await Promise.all([this.refreshSubscription(), this.refreshPlans()]);
  }

  async refreshSubscription(): Promise<void> {
    try {
      const { subscription, adRemoval } = await this.http.get<{ subscription: Subscription; adRemoval?: AdRemoval }>(`${this.baseUrl}/me`).toPromise() as { subscription: Subscription; adRemoval?: AdRemoval };
      this.subscriptionSignal.set(subscription);
      this.adRemovalSignal.set(adRemoval ?? NO_AD_REMOVAL);
    } catch {
      // Leaves the last-known tier in place rather than silently downgrading
      // someone to Free on a flaky connection.
    }
  }

  private async refreshPlans(): Promise<void> {
    try {
      const { tiers, adRemoval } = await this.http.get<{ tiers: Tier[]; adRemoval?: AdRemovalPlans }>(`${this.baseUrl}/plans`).toPromise() as { tiers: Tier[]; adRemoval?: AdRemovalPlans };
      this.tiersSignal.set(tiers);
      this.adRemovalPlansSignal.set(adRemoval ?? null);
    } catch {
      // Pricing page shows its own retry state; other consumers only need
      // subscription(), not the plan list, so this failing alone shouldn't
      // block them.
    }
  }

  /** Sends a completed Google Play purchase to the backend for verification
   * against Google's own records -- see BillingService, which calls this
   * from the purchase-approved callback. */
  verify(productId: string, purchaseToken: string): Observable<{ subscription: Subscription; adRemoval?: AdRemoval }> {
    return this.http
      .post<{ subscription: Subscription; adRemoval?: AdRemoval }>(`${this.baseUrl}/verify`, { productId, purchaseToken })
      .pipe(
        tap(({ subscription, adRemoval }) => {
          this.subscriptionSignal.set(subscription);
          if (adRemoval) this.adRemovalSignal.set(adRemoval);
        }),
      );
  }

  reset(): void {
    this.loaded = false;
    this.subscriptionSignal.set(FREE_SUBSCRIPTION);
    this.adRemovalSignal.set(NO_AD_REMOVAL);
  }
}
