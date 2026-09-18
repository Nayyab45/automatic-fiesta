export async function up(pool) {
  // One row per (viewer, viewed) pair -- re-viewing the same profile updates
  // viewed_at instead of piling up duplicate rows, so "who viewed your
  // profile" shows each viewer once, most-recent visit first.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile_views (
      viewer_user_id INT NOT NULL,
      viewed_user_id INT NOT NULL,
      viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (viewer_user_id, viewed_user_id)
    )
  `);
}
