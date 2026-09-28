import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toCamel } from '../lib/serialize.js';
import { TIERS, featuresFor, publicTierList, tierForProductId } from '../lib/tiers.js';
import { verifySubscriptionPurchase, acknowledgeSubscriptionPurchase } from '../lib/googlePlay.js';

export const subscriptionsRouter = Router();

async function logEvent(userId, eventType, productId, purchaseToken, rawResponse) {
  await db.prepare(
    `INSERT INTO subscription_events (user_id, event_type, play_product_id, play_purchase_token, raw_response)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(userId, eventType, productId ?? null, purchaseToken ?? null, rawResponse ?? null);
}

// Exported for other routers that need to know someone's plan -- same
// pattern the pre-removal subscriptions.js used (tables.js/profile.js
// import these the same way).
export async function subscriptionFor(userId) {
  const row = await db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  if (!row) {
    return { tier: 'free', status: 'inactive', currentPeriodEnd: null, autoRenewing: false };
  }
  return toCamel(row);
}

// A canceled/expired/on_hold subscription still counts as free features
// only -- "tier" on the row is what they last paid for, "status" is whether
// that's currently in effect. Grace period still counts as active: Google
// keeps billing retrying and the entitlement is meant to stay live while it
// does.
export async function tierFor(userId) {
  const sub = await subscriptionFor(userId);
  return sub.status === 'active' || sub.status === 'grace_period' ? sub.tier : 'free';
}

export async function hasFeature(userId, feature) {
  return featuresFor(await tierFor(userId))[feature] === true;
}

export async function tableLimitFor(userId) {
  return featuresFor(await tierFor(userId)).monthlyTableLimit;
}

// Batched tier lookup for a list of candidates (Discover People/Matches
// priority placement + tier badge) -- one query instead of one per
// candidate, same reasoning as profile.js's interestsForBatch.
export async function tiersFor(userIds) {
  const map = new Map(userIds.map((id) => [id, 'free']));
  if (!userIds.length) return map;
  const placeholders = userIds.map(() => '?').join(',');
  const rows = await db
    .prepare(
      `SELECT user_id, tier FROM subscriptions
       WHERE status IN ('active', 'grace_period') AND user_id IN (${placeholders})`,
    )
    .all(...userIds);
  for (const row of rows) map.set(row.user_id, row.tier);
  return map;
}

subscriptionsRouter.use(requireAuth);

subscriptionsRouter.get('/plans', (_req, res) => {
  res.json({ tiers: publicTierList() });
});

subscriptionsRouter.get('/me', asyncHandler(async (req, res) => {
  res.json({ subscription: await subscriptionFor(req.user.sub) });
}));

// Called right after a successful Google Play purchase flow (and on app
// start, to re-verify/restore an existing purchase) -- see billing.service.ts.
// productId/purchaseToken are never trusted at face value: verifySubscriptionPurchase
// asks Google directly what that token is actually worth before this ever
// activates a tier.
subscriptionsRouter.post('/verify', asyncHandler(async (req, res) => {
  const { productId, purchaseToken } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['productId', 'purchaseToken']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const tier = tierForProductId(productId);
  if (!tier) {
    return res.status(400).json({ message: `Unknown product id: ${productId}` });
  }

  let purchase;
  try {
    purchase = await verifySubscriptionPurchase(productId, purchaseToken);
  } catch (err) {
    await logEvent(req.user.sub, 'verify_failed', productId, purchaseToken, err.message);
    return res.status(502).json({ message: 'Could not verify this purchase with Google Play. Please try again.' });
  }

  // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = pending
  // deferred upgrade/downgrade. Only 1/2 actually entitle the tier -- a
  // pending payment shouldn't unlock anything yet. autoRenewing = false
  // (the user hit "Cancel subscription" in Play Store) still means active:
  // they paid for the current period and keep the tier until it actually
  // expires, same as tierFor()'s comment on 'canceled' status covers.
  //
  // Detecting that expiry (or a failed renewal, refund, etc.) the moment it
  // happens needs Google's Real-time Developer Notifications (a Pub/Sub
  // topic this backend would subscribe to) -- not set up here. Until then,
  // this row is only as fresh as the last time the app called /verify
  // (app start, or right after a purchase), same limitation the comment on
  // subscription_events documents for the audit trail.
  const paymentReceived = purchase.paymentState === 1 || purchase.paymentState === 2;
  const status = paymentReceived ? 'active' : 'inactive';
  const currentPeriodEnd = purchase.expiryTimeMillis ? new Date(Number(purchase.expiryTimeMillis)) : null;

  await db.prepare(
    `INSERT INTO subscriptions (user_id, tier, status, play_product_id, play_purchase_token, current_period_end, auto_renewing, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE tier = VALUES(tier), status = VALUES(status), play_product_id = VALUES(play_product_id),
       play_purchase_token = VALUES(play_purchase_token), current_period_end = VALUES(current_period_end),
       auto_renewing = VALUES(auto_renewing), updated_at = NOW()`,
  ).run(req.user.sub, tier, status, productId, purchaseToken, currentPeriodEnd, purchase.autoRenewing ? 1 : 0);

  // Must happen within 3 days of the charge or Google auto-refunds it.
  // Best-effort: a failure here doesn't undo the entitlement just granted
  // above, it just means this attempt didn't get to ack -- worth retrying
  // on the next /verify call (e.g. app restart), which is idempotent.
  if (paymentReceived && purchase.acknowledgementState === 0) {
    await acknowledgeSubscriptionPurchase(productId, purchaseToken).catch((err) => {
      logEvent(req.user.sub, 'acknowledge_failed', productId, purchaseToken, err.message);
    });
  }

  await logEvent(req.user.sub, 'verified', productId, purchaseToken, JSON.stringify(purchase));

  res.json({ subscription: await subscriptionFor(req.user.sub) });
}));

export { TIERS };
