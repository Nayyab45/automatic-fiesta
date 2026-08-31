// No real payment processing exists yet (no gateway/merchant credentials
// configured) -- this table only stores what a user has saved for later,
// never anything that could itself be replayed as a charge: no full card
// number, no CVV, no bank PIN. Card/bank numbers are truncated to last4
// client-side before they ever reach this API; wallet_phone is kept in full
// because a mobile-wallet number is an identifier (like an email or IBAN),
// not a secret, and is what a real EasyPaisa/JazzCash integration would
// need to actually address a transaction later.
export const paymentsSchema = `
  CREATE TABLE IF NOT EXISTS payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK(type IN ('visa', 'bank', 'easypaisa', 'jazzcash')),
    last4 VARCHAR(4),
    expiry_month INT,
    expiry_year INT,
    cardholder_name VARCHAR(255),
    bank_name VARCHAR(255),
    account_title VARCHAR(255),
    wallet_phone VARCHAR(50),
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- One row per user, upserted in place rather than a history of rows --
  -- current entitlement state is all the app needs to gate premium features.
  -- provider/plan are null until the first successful charge activates it.
  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id INT PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive', 'active', 'canceled', 'past_due')),
    plan VARCHAR(20) NULL CHECK(plan IN ('monthly', 'yearly')),
    provider VARCHAR(20) NULL CHECK(provider IN ('visa', 'bank', 'easypaisa', 'jazzcash')),
    current_period_end DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- An audit trail independent of subscriptions' current-state row: every
  -- checkout attempt (not just successful ones) gets a row, so a failed or
  -- pending charge is still visible after the fact. provider_txn_ref is the
  -- gateway's own reference for that attempt; the UNIQUE pair with provider
  -- makes a webhook retry (the same callback delivered twice) a no-op
  -- instead of double-processing the same charge.
  CREATE TABLE IF NOT EXISTS payment_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    payment_method_id INT NULL,
    provider VARCHAR(20) NOT NULL CHECK(provider IN ('visa', 'bank', 'easypaisa', 'jazzcash')),
    provider_txn_ref VARCHAR(100) NOT NULL,
    plan VARCHAR(20) NOT NULL CHECK(plan IN ('monthly', 'yearly')),
    amount_pkr DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'succeeded', 'failed')),
    raw_response TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_txn_ref)
  );
`;
