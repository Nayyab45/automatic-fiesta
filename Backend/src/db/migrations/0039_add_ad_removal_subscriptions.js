// "Remove ads" is its own Play subscription product (removal_ads, with a
// monthly and a yearly base plan), separate from the Basic/Standard/Premium
// tiers in `subscriptions` -- someone on Standard can also buy it, and the
// two purchases must not overwrite each other, so it gets its own row per
// user instead of reusing subscriptions' one-row-per-user tier column. See
// lib/tiers.js (AD_REMOVAL) and routes/subscriptions.js.
export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ad_removal_subscriptions (
      user_id INT PRIMARY KEY,
      base_plan VARCHAR(20) NOT NULL CHECK(base_plan IN ('monthly', 'yearly')),
      status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive', 'active', 'canceled', 'grace_period', 'on_hold', 'expired')),
      play_purchase_token VARCHAR(500) NULL,
      current_period_end DATETIME NULL,
      auto_renewing TINYINT(1) NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
