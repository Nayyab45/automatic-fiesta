export async function up(pool) {
  // Separate from profile_views (0023): that table dedupes to one row per
  // (viewer, viewed) pair on purpose, for the "who viewed your profile"
  // identity list -- but that same dedup means COUNT(*) against it is really
  // "how many distinct people have ever viewed me", which stops moving the
  // moment your usual visitors have each viewed you once. This table has no
  // unique constraint and gets a fresh row on every view, so
  // profileViewsCount (see profile.js) reflects total view events instead.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile_view_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      viewer_user_id INT NOT NULL,
      viewed_user_id INT NOT NULL,
      viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX idx_profile_view_events_viewed ON profile_view_events (viewed_user_id)');

  // Seed one event per existing profile_views row so the count doesn't drop
  // to zero for anyone who already had views recorded under the old scheme.
  await pool.query(`
    INSERT INTO profile_view_events (viewer_user_id, viewed_user_id, viewed_at)
    SELECT viewer_user_id, viewed_user_id, viewed_at FROM profile_views
  `);
}
