// Server-side source of truth for what a plan costs. The checkout endpoint
// looks the price up from here by plan id -- it never accepts an amount
// from the client, since a client-supplied charge amount is trivially
// tampered with (pay $0.01 for premium).
//
// amountPkr is what actually gets charged -- JazzCash/EasyPaisa only settle
// in PKR. amountUsd is display-only, matching the numbers already shown in
// the app's UI; the PKR figures below are that same price at a fixed,
// approximate rate (~280 PKR/USD) since there's no live FX source wired in.
// Replace with real pricing before launch.
export const PLANS = {
  monthly: { amountPkr: 2800, amountUsd: 9.99 },
  yearly: { amountPkr: 26900, amountUsd: 95.9 },
};

export function isValidPlan(plan) {
  return Object.prototype.hasOwnProperty.call(PLANS, plan);
}
