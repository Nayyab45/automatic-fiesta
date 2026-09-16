export async function up(pool) {
  // A separate, real Google Maps rating/review-count for a restaurant --
  // distinct from restaurants.rating/review_count, which this app
  // recomputes from its own users' in-app reviews (see
  // recomputeRestaurantRating in routes/restaurants.js) and must stay a
  // genuine reflection of that, not get silently overwritten by an
  // imported number. Populated only for restaurants a human verified
  // against a real, cited source (see scripts/seed-google-ratings.mjs) --
  // null for everything else, never guessed.
  await pool.query('ALTER TABLE restaurants ADD COLUMN google_rating DOUBLE NULL');
  await pool.query('ALTER TABLE restaurants ADD COLUMN google_review_count INT NULL');
}
