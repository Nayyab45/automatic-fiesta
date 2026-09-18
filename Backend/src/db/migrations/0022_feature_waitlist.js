export async function up(pool) {
  // One row per user -- resubmitting the form (e.g. after a fresh page
  // load) should just no-op rather than creating duplicate signups.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_waitlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      email VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_feature_waitlist_user (user_id)
    )
  `);
}
