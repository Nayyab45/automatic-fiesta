// Reintroduces subscription state (see 0030_drop_payment_tables, which
// removed the previous single-tier/local-gateway version) redesigned around
// 4 tiers billed through Google Play Billing instead of a local card/bank/
// wallet gateway -- see lib/tiers.js and lib/googlePlay.js. No payment
// method details are stored here at all: Play Billing never hands the app
// anything to store, only a purchase token it can ask Google about.
export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id INT PRIMARY KEY,
      tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK(tier IN ('free', 'basic', 'standard', 'premium')),
      status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive', 'active', 'canceled', 'grace_period', 'on_hold', 'expired')),
      play_product_id VARCHAR(100) NULL,
      play_purchase_token VARCHAR(500) NULL,
      current_period_end DATETIME NULL,
      auto_renewing TINYINT(1) NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Audit trail independent of subscriptions' current-state row, same
  // reasoning as the old payment_transactions table: every verify attempt
  // (not just successful ones) gets a row, so a failed Play verification is
  // still visible after the fact instead of silently vanishing.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      event_type VARCHAR(30) NOT NULL,
      play_product_id VARCHAR(100) NULL,
      play_purchase_token VARCHAR(500) NULL,
      raw_response TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
