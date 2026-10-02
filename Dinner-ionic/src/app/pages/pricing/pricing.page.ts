import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { AD_REMOVAL_PRODUCT_ID, AdRemovalBasePlanId, BillingService, PlayProductId } from '../../services/billing.service';
import { AdRemovalPlan, SubscriptionService, Tier, TierId } from '../../services/subscription.service';
import { AdmobService } from '../../services/admob.service';

const TIER_ORDER: TierId[] = ['free', 'basic', 'standard', 'premium'];

interface ComparisonCell {
  /** Plain text (e.g. "Unlimited", "3") -- rendered instead of a check/cross
   * icon when set. */
  text: string | null;
  /** Rendered as a check/cross icon when `text` is null. */
  included: boolean;
}

interface ComparisonRow {
  label: string;
  cellFor: (tier: Tier) => ComparisonCell;
}

// One row per perk, keyed off the same TierFeatures flags the backend
// actually enforces (see Backend/src/lib/tiers.js) -- this can't silently
// drift out of sync with what a tier really unlocks the way separately
// maintained marketing copy could.
const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Ads', cellFor: (tier) => ({ text: tier.features.noAds ? 'Removed' : 'Shown (AdMob)', included: tier.features.noAds }) },
  {
    label: 'Monthly table limit',
    cellFor: (tier) => ({ text: tier.features.unlimitedTables ? 'Unlimited' : `${tier.features.monthlyTableLimit}`, included: true }),
  },
  { label: 'Advanced filters', cellFor: (tier) => ({ text: null, included: tier.features.advancedFilters }) },
  { label: 'Profile viewers (who viewed you)', cellFor: (tier) => ({ text: null, included: tier.features.profileViewers }) },
  { label: 'AI insights', cellFor: (tier) => ({ text: null, included: tier.features.aiInsights }) },
  { label: 'Priority placement (Discover/Matches)', cellFor: (tier) => ({ text: null, included: tier.features.priorityPlacement }) },
];

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './pricing.page.html',
  styleUrl: './pricing.page.scss',
})
export class PricingPage extends BasePage implements OnInit {
  readonly pageTitle = 'Plans & Pricing';

  private readonly billingService = inject(BillingService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly admobService = inject(AdmobService);

  readonly isNative = Capacitor.isNativePlatform();
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly currentTier = this.subscriptionService.tier;
  readonly purchasingProductId = this.billingService.purchasing;

  readonly adRemovalPlans = computed(() => this.subscriptionService.adRemovalPlans()?.plans ?? []);
  readonly adRemoval = this.subscriptionService.adRemoval;
  readonly adRemovalActive = this.subscriptionService.adRemovalActive;

  readonly tiers = computed(() => {
    const byId = new Map(this.subscriptionService.tiers().map((tier) => [tier.id, tier]));
    return TIER_ORDER.map((id) => byId.get(id)).filter((tier): tier is Tier => !!tier);
  });

  /** Every perk for one tier, included and excluded alike -- each card shows
   * its own full list rather than only what it unlocks, so it's obvious at
   * a glance what upgrading from THIS tier would actually add. */
  featureRowsFor(tier: Tier): { label: string; included: boolean }[] {
    return COMPARISON_ROWS.map((row) => {
      const cell = row.cellFor(tier);
      return { label: cell.text ? `${row.label}: ${cell.text}` : row.label, included: cell.included };
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      await Promise.all([this.subscriptionService.load(), this.billingService.init()]);
    } finally {
      this.loading.set(false);
    }
  }

  isCurrent(tier: Tier): boolean {
    return tier.id === this.currentTier();
  }

  async subscribe(tier: Tier): Promise<void> {
    if (!tier.playProductId || this.purchasingProductId()) return;
    this.errorMessage.set(null);

    if (!this.isNative) {
      this.errorMessage.set('Subscribing is only available in the Android app.');
      return;
    }

    try {
      await this.billingService.purchase(tier.playProductId as PlayProductId);
      this.admobService.refresh();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  isCurrentAdRemovalPlan(plan: AdRemovalPlan): boolean {
    return this.adRemovalActive() && this.adRemoval().basePlan === plan.basePlanId;
  }

  /** Play's own localized price once the store has answered, else the
   * backend's plain PKR number. */
  adRemovalPrice(plan: AdRemovalPlan): string {
    const product = this.billingService.products().find((p) => p.id === AD_REMOVAL_PRODUCT_ID);
    return product?.basePlanPrices[plan.basePlanId] || `Rs ${plan.pricePkr}`;
  }

  adRemovalPurchaseKey(plan: AdRemovalPlan): string {
    return `${AD_REMOVAL_PRODUCT_ID}@${plan.basePlanId}`;
  }

  async subscribeAdRemoval(plan: AdRemovalPlan): Promise<void> {
    if (this.purchasingProductId()) return;
    this.errorMessage.set(null);

    if (!this.isNative) {
      this.errorMessage.set('Subscribing is only available in the Android app.');
      return;
    }

    try {
      await this.billingService.purchase(AD_REMOVAL_PRODUCT_ID, plan.basePlanId as AdRemovalBasePlanId);
      this.admobService.refresh();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  async restore(): Promise<void> {
    this.errorMessage.set(null);
    try {
      await this.billingService.restore();
      await this.subscriptionService.refreshSubscription();
      this.admobService.refresh();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Could not restore purchases.');
    }
  }
}
