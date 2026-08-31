export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS two_factor_auth (
      user_id INT PRIMARY KEY,
      -- Base32 TOTP secret (otplib's default). Written here as soon as
      -- setup starts, before the user has confirmed a code -- enabled
      -- stays 0 until /auth/2fa/enable verifies one, so an abandoned setup
      -- never accidentally locks anyone out.
      secret VARCHAR(64) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
