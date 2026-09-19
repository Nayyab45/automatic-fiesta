import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { PLANS, isValidPlan } from '../lib/plans.js';
import { getGateway } from '../lib/paymentGateways/index.js';

export const subscriptionsRouter = Router();
// The gateway callback below is hit by the payment gateway itself, not a
// logged-in user's browser -- it can't carry this app's session token, so
// it's mounted before requireAuth applies to the rest of the router.
export const subscriptionCallbackRouter = Router();

function periodEnd(plan) {
  const end = new Date();
  if (plan === 'monthly') {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

async function activateSubscription(userId, plan, provider) {
  await db.prepare(
    `INSERT INTO subscriptions (user_id, status, plan, provider, current_period_end, updated_at)
     VALUES (?, 'active', ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE status = 'active', plan = VALUES(plan), provider = VALUES(provider),
       current_period_end = VALUES(current_period_end), updated_at = NOW()`,
  ).run(userId, plan, provider, periodEnd(plan));
}

// Exported for other routers that need to know someone's premium status --
// same pattern as messaging.js's createNotification export (tables.js
// already imports that one the same way).
export async function subscriptionFor(userId) {
  const row = await db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  if (!row) {
    return { status: 'inactive', plan: null, provider: null, currentPeriodEnd: null };
  }
  return {
    status: row.status,
    plan: row.plan,
    provider: row.provider,
    currentPeriodEnd: row.current_period_end,
  };
}

// Product decision: every "Premium" feature (unlimited events, advanced
// people filters, profile viewers, AI match reasons, no ads) is available to
// everyone, no payment needed. Set PREMIUM_FEATURES_FREE_FOR_ALL=false in the
// server's .env to bring back the paid gating from the proposal's Revenue
// Model -- every gate calls hasPremiumFeatures() below, so that one setting
// is the only thing that changes. Read on every call (not cached at import).
// Deliberately separate from a real subscription: isPremium (the badge and
// priority placement) still means "actually paid".
export function premiumFeaturesFree() {
  return process.env.PREMIUM_FEATURES_FREE_FOR_ALL !== 'false';
}

export async function hasPremiumFeatures(userId) {
  return premiumFeaturesFree() || (await subscriptionFor(userId)).status === 'active';
}

// Batched premium check for a list of candidates (Discover People/Matches
// priority placement + premium badge) -- one query instead of one per
// candidate, same reasoning as profile.js's interestsForBatch.
export async function activePremiumUserIds(userIds) {
  if (!userIds.length) return new Set();
  const placeholders = userIds.map(() => '?').join(',');
  const rows = await db
    .prepare(`SELECT user_id FROM subscriptions WHERE status = 'active' AND user_id IN (${placeholders})`)
    .all(...userIds);
  return new Set(rows.map((row) => row.user_id));
}

subscriptionsRouter.use(requireAuth);

subscriptionsRouter.get('/me', asyncHandler(async (req, res) => {
  res.json({ subscription: await subscriptionFor(req.user.sub), premiumFeaturesFree: premiumFeaturesFree() });
}));

subscriptionsRouter.post('/checkout', asyncHandler(async (req, res) => {
  const { paymentMethodId, plan, cnicLast6 } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['paymentMethodId', 'plan']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  if (!isValidPlan(plan)) {
    return res.status(400).json({ message: `plan must be one of: ${Object.keys(PLANS).join(', ')}` });
  }

  const method = await db.prepare('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?').get(paymentMethodId, req.user.sub);
  if (!method) {
    return res.status(404).json({ message: 'Payment method not found' });
  }

  const gateway = getGateway(method.type);
  if (!gateway || !gateway.isConfigured()) {
    return res.status(503).json({
      message: `Payment processing for ${method.type} isn't connected yet. Add its API credentials to the backend's .env to enable it.`,
    });
  }

  // amountPkr always comes from the server-side PLANS lookup above, never
  // from the request -- a client-supplied charge amount would let anyone
  // pay whatever they want for premium.
  const { amountPkr } = PLANS[plan];
  const txnRefNo = `WSWE${Date.now()}${randomBytes(4).toString('hex')}`;
  const description = `What Should We Eat - ${plan} premium`;

  // Recorded before calling the gateway so a network failure mid-request
  // still leaves an audit trail instead of silently vanishing.
  await db.prepare(
    `INSERT INTO payment_transactions (user_id, payment_method_id, provider, provider_txn_ref, plan, amount_pkr, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
  ).run(req.user.sub, method.id, method.type, txnRefNo, plan, amountPkr);

  const returnUrl = `${req.protocol}://${req.get('host')}/api/subscriptions/callback/${method.type}`;
  const result = await gateway.initiateCharge({
    amountPkr,
    txnRefNo,
    description,
    walletPhone: method.wallet_phone,
    cnicLast6,
    returnUrl,
  });

  if (result.success === true) {
    await db.prepare('UPDATE payment_transactions SET status = ?, raw_response = ? WHERE provider = ? AND provider_txn_ref = ?').run(
      'succeeded',
      JSON.stringify(result.raw ?? {}),
      method.type,
      txnRefNo,
    );
    await activateSubscription(req.user.sub, plan, method.type);
    return res.json({ status: 'succeeded', subscription: await subscriptionFor(req.user.sub) });
  }

  if (result.success === false) {
    await db.prepare('UPDATE payment_transactions SET status = ?, raw_response = ? WHERE provider = ? AND provider_txn_ref = ?').run(
      'failed',
      JSON.stringify(result.raw ?? {}),
      method.type,
      txnRefNo,
    );
    return res.status(402).json({ status: 'failed', message: result.message });
  }

  // success === null: hosted-checkout gateway, outcome isn't known until
  // the customer completes it and the callback below fires.
  res.json({ status: 'redirect', redirectUrl: result.redirectUrl });
}));

// Public: the payment gateway calls this directly, not the app.
subscriptionCallbackRouter.post('/:provider', asyncHandler(async (req, res) => {
  const gateway = getGateway(req.params.provider);
  if (!gateway || !gateway.verifyCallback) {
    return res.status(404).json({ message: 'Unknown payment provider' });
  }

  const result = gateway.verifyCallback({ ...req.query, ...req.body });
  if (!result.valid) {
    return res.status(400).json({ message: 'Invalid callback signature' });
  }

  const transaction = await db
    .prepare('SELECT * FROM payment_transactions WHERE provider = ? AND provider_txn_ref = ?')
    .get(req.params.provider, result.providerTxnRef);
  if (!transaction) {
    return res.status(404).json({ message: 'Unknown transaction' });
  }
  // A gateway can legitimately deliver the same callback twice (retry on a
  // slow response) -- only act on it once.
  if (transaction.status !== 'pending') {
    return res.json({ ok: true });
  }

  await db.prepare('UPDATE payment_transactions SET status = ?, raw_response = ? WHERE id = ?').run(
    result.success ? 'succeeded' : 'failed',
    JSON.stringify(result.raw ?? {}),
    transaction.id,
  );

  if (result.success) {
    await activateSubscription(transaction.user_id, transaction.plan, req.params.provider);
  }

  res.json({ ok: true });
}));
