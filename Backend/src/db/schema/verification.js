export const verificationSchema = `
  CREATE TABLE IF NOT EXISTS identity_verifications (
    user_id INT PRIMARY KEY,
    id_front_url TEXT,
    id_back_url TEXT,
    selfie_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','pending','approved','rejected')),
    submitted_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;
