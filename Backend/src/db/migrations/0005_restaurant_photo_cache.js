export async function up(pool) {
  // One enhanced stock photo per distinct cuisine_tags value, reused across
  // every restaurant that shares it -- see getOrCreateCuisinePhoto in
  // src/lib/restaurantPhotos.js. Keyed by the raw cuisine string rather than
  // a normalized id since that's already how restaurants.cuisine_tags itself
  // is stored/compared elsewhere in this codebase.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cuisine_stock_photos (
      cuisine VARCHAR(255) NOT NULL PRIMARY KEY,
      photo_url TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
