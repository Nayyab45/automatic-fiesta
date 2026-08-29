export const verificationSchema = `
  CREATE TABLE IF NOT EXISTS identity_verifications (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    id_front_url TEXT,
    id_back_url TEXT,
    selfie_url TEXT,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','pending','approved','rejected')),
    submitted_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;
