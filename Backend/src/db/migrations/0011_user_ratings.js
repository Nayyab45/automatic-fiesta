export async function up(pool) {
  // One row per (table, rater, rated) -- someone can rate each fellow
  // attendee of a table once, editable afterward (ON DUPLICATE KEY UPDATE
  // at the call site), never re-created per table. Gated at the route level
  // to attendees of a table whose date_time has passed -- see
  // tablesRouter's /:id/rateable and /:id/rate in tables.js.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_id INT NOT NULL,
      rater_user_id INT NOT NULL,
      rated_user_id INT NOT NULL,
      score INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE(table_id, rater_user_id, rated_user_id)
    )
  `);
  await pool.query('CREATE INDEX idx_user_ratings_rated ON user_ratings (rated_user_id)');
}
