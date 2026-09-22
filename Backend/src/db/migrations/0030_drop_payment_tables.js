// Premium/payment gating was removed from the app (all features are free
// for everyone now) -- see the deleted routes/payments.js, routes/subscriptions.js
// and lib/paymentGateways/. Nothing reads or writes these tables anymore.
export async function up(pool) {
  await pool.query('DROP TABLE IF EXISTS payment_transactions');
  await pool.query('DROP TABLE IF EXISTS subscriptions');
  await pool.query('DROP TABLE IF EXISTS payment_methods');
}
