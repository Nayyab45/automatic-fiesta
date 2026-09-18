// One-off: the 12 "flagship" restaurants carried over from the original
// static prototype (Haveli, Kolachi, Xander's, etc. -- source = 'seed')
// were seeded with placeholder rating/review_count numbers lifted from that
// mockup (e.g. "4.9, 920 reviews") despite having zero real reviews in the
// app -- presenting fabricated social proof as genuine. Resets them to the
// same honest null/"Not yet rated" state every real (OSM-imported)
// restaurant already starts in; restaurants.js's review-posting handler is
// the only thing that should set these from here on (see
// src/db/seed/restaurants.js, fixed the same way for future fresh seeds).
// Run with `node scripts/fix-fabricated-seed-ratings.mjs`.
import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

const [seeded] = await pool.query("SELECT id, name, rating, review_count FROM restaurants WHERE source = 'seed'");

let fixed = 0;
let skippedReal = 0;
for (const restaurant of seeded) {
  const [[{ c: realReviewCount }]] = await pool.query('SELECT COUNT(*) as c FROM restaurant_reviews WHERE restaurant_id = ?', [restaurant.id]);
  if (realReviewCount > 0) {
    // Someone has actually reviewed this one since it was seeded -- leave
    // it alone, its rating/review_count are presumably already the real
    // aggregate restaurants.js computed from those reviews.
    console.log(`SKIP (has ${realReviewCount} real review(s)): ${restaurant.name}`);
    skippedReal++;
    continue;
  }
  await pool.query('UPDATE restaurants SET rating = NULL, review_count = 0 WHERE id = ?', [restaurant.id]);
  console.log(`FIXED: ${restaurant.name} (was rating ${restaurant.rating}, review_count ${restaurant.review_count})`);
  fixed++;
}

console.log(`\nFixed ${fixed}, skipped ${skippedReal} with real reviews (of ${seeded.length} seed restaurants).`);
await pool.end();
