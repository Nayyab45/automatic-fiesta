export async function up(pool) {
  // Standalone restaurant reviews -- separate from `reviews` (src/db/schema/tables.js),
  // which is scoped to a specific hosted dining table/event. This lets anyone
  // who's actually used the app rate a restaurant directly, independent of
  // ever having hosted or joined a table there, so restaurants.rating
  // becomes a genuine figure instead of staying null/seeded forever.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurant_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT NOT NULL,
      reviewer_user_id INT NOT NULL,
      rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(restaurant_id, reviewer_user_id)
    )
  `);
}
