export async function up(pool) {
  // One row per (user, installed app instance) FCM registration token, so
  // push notifications (see src/lib/push.js) can be sent to every device a
  // user is signed into. `token` is UNIQUE rather than (user_id, token)
  // since the same physical token reassigning to a different user on
  // sign-out/sign-in should move, not duplicate.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX idx_device_tokens_user ON device_tokens (user_id)');
}
