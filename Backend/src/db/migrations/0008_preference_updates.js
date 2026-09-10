export async function up(pool) {
  // Logs each time a user saves the Edit Preferences page, so that save can
  // be capped at 2 changes per calendar month (see profile.js's
  // PUT /me/preferences) -- food/dietary/match preferences are meant to be
  // fairly stable, and unlimited changes made them too easy to game the
  // matching algorithm with.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS preference_updates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX idx_preference_updates_user_time ON preference_updates (user_id, updated_at)');
}
