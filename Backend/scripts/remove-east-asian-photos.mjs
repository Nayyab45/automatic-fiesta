// One-off cleanup: Openverse's keyword search had been surfacing East
// Asian stock photos (Chinese/Japanese/Korean signage, Hong Kong Wikimedia
// contributors' captions, "tokyo", "sushi", etc.) for cuisines that have
// nothing to do with them -- e.g. 4 of the 15 photos in the generic
// "Restaurant" pool (used by 191 restaurants) were Japan-related. Now that
// restaurantPhotos.js's dishSearchQueryFor/looksEastAsian filter search
// results going forward, this purges the already-cached offenders so they
// get regenerated. Run scripts/diversify-restaurant-photos.mjs afterward to
// refill the purged slots and reassign restaurants.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { looksEastAsian } from '../src/lib/restaurantPhotos.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

const [photos] = await pool.query('SELECT id, cuisine, photo_url, attribution FROM cuisine_stock_photos');
const bad = photos.filter((p) => looksEastAsian(p.attribution));

console.log(`${photos.length} cached cuisine photos, ${bad.length} flagged as East Asian in origin:`);
for (const photo of bad) {
  console.log(`  [${photo.cuisine}] ${photo.attribution}`);
}

if (bad.length) {
  const badUrls = bad.map((p) => p.photo_url);
  const [restaurantsResult] = await pool.query(
    `UPDATE restaurants SET photo_url = NULL, photo_attribution = NULL WHERE photo_url IN (${badUrls.map(() => '?').join(',')})`,
    badUrls,
  );
  console.log(`\n${restaurantsResult.affectedRows} restaurants using a flagged photo were reset to no photo.`);

  await pool.query(
    `DELETE FROM cuisine_stock_photos WHERE id IN (${bad.map(() => '?').join(',')})`,
    bad.map((p) => p.id),
  );
  console.log(`${bad.length} flagged rows deleted from cuisine_stock_photos.`);
}

await pool.end();
