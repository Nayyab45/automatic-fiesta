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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('visa', 'bank', 'easypaisa', 'jazzcash')),
    last4 TEXT,
    expiry_month INTEGER,
    expiry_year INTEGER,
    cardholder_name TEXT,
    bank_name TEXT,
    account_title TEXT,
    wallet_phone TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;
