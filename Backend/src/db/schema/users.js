export const usersSchema = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Stores a hash of each refresh token, never the token itself, so a DB
  -- read alone can't be replayed as a valid session. expires_at is a plain
  -- ISO string (not a native DATETIME) because it's compared directly
  -- against new Date().toISOString() in JS -- keeping both sides the exact
  -- same string format avoids a format-mismatch bug in that comparison.
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at VARCHAR(40) NOT NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Same hash-only-storage reasoning as refresh_tokens above, and the same
  -- reason expires_at is a plain string: it's compared against
  -- new Date().toISOString() in JS.
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at VARCHAR(40) NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;
