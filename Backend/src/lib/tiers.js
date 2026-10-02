// Server-side source of truth for what each tier costs and unlocks. Routes
// look feature access up from here by tier id -- never from anything the
// client sends -- and the Play purchase verification flow looks the tier up
// from the Play product id, so a client can't claim a higher tier than what
// it actually paid for.
//
// playProductId must exactly match a subscription product id created in
// Play Console (Monetize -> Subscriptions) for this app (weeat.netstech.net).
// See Backend/PLAY_BILLING_SETUP.md for the exact steps to create them.
export const TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    pricePkr: 0,
    playProductId: null,
    features: {
      noAds: false,
      monthlyTableLimit: 3,
      advancedFilters: false,
      profileViewers: false,
      aiInsights: false,
      priorityPlacement: false,
    },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    pricePkr: 500,
    playProductId: 'weeat_basic_monthly',
    features: {
      noAds: true,
      monthlyTableLimit: 10,
      advancedFilters: false,
      profileViewers: false,
      aiInsights: false,
      priorityPlacement: false,
    },
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    pricePkr: 1000,
    playProductId: 'weeat_standard_monthly',
    features: {
      noAds: true,
      monthlyTableLimit: Infinity,
      advancedFilters: true,
      profileViewers: true,
      aiInsights: false,
      priorityPlacement: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    pricePkr: 2000,
    playProductId: 'weeat_premium_monthly',
    features: {
      noAds: true,
      monthlyTableLimit: Infinity,
      advancedFilters: true,
      profileViewers: true,
      aiInsights: true,
      priorityPlacement: true,
    },
  },
};

// Standalone "Remove ads" add-on: one Play subscription product with two base
// plans (the base plan ids below must match Play Console exactly). Independent
// of the tiers above -- see migration 0039 and routes/subscriptions.js.
export const AD_REMOVAL = {
  productId: 'removal_ads',
  plans: {
    monthly: { basePlanId: 'monthly', pricePkr: 500, period: 'month' },
    yearly: { basePlanId: 'yearly', pricePkr: 5500, period: 'year' },
  },
};

export function isAdRemovalProduct(productId) {
  return productId === AD_REMOVAL.productId;
}

export function isAdRemovalBasePlan(basePlanId) {
  return Object.prototype.hasOwnProperty.call(AD_REMOVAL.plans, basePlanId);
}

export function publicAdRemoval() {
  return { productId: AD_REMOVAL.productId, plans: Object.values(AD_REMOVAL.plans) };
}

export const TIER_IDS = Object.keys(TIERS);

export function isValidTier(tier) {
  return Object.prototype.hasOwnProperty.call(TIERS, tier);
}

export function tierForProductId(productId) {
  return TIER_IDS.find((id) => TIERS[id].playProductId === productId) ?? null;
}

export function featuresFor(tier) {
  return TIERS[tier]?.features ?? TIERS.free.features;
}

// JSON-safe view of TIERS for the /plans endpoint -- Infinity doesn't
// survive res.json() (becomes `null`), so it's normalized to a plain field
// the frontend can check instead (unlimited: true).
export function publicTierList() {
  return TIER_IDS.map((id) => {
    const tier = TIERS[id];
    return {
      id: tier.id,
      name: tier.name,
      pricePkr: tier.pricePkr,
      playProductId: tier.playProductId,
      features: {
        ...tier.features,
        monthlyTableLimit: Number.isFinite(tier.features.monthlyTableLimit) ? tier.features.monthlyTableLimit : null,
        unlimitedTables: !Number.isFinite(tier.features.monthlyTableLimit),
      },
    };
  });
}
