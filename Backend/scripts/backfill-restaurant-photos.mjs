// One-off: adds photos to real (OSM-imported) restaurants that were fetched
// before this feature existed, so they don't stay photo-less forever just
// because their city was already imported. New imports get photos
// automatically now (see src/lib/osmPlaces.js) -- this only needs running
// once against already-populated data. Run with
// `node scripts/backfill-restaurant-photos.mjs`.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { getOrCreateCuisinePhoto } from '../src/lib/restaurantPhotos.js';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// Matches the db.js wrapper's shape so getOrCreateCuisinePhoto (written
// against that interface) works unchanged here.
const db = {
  prepare(sql) {
    return {
      async get(...params) {
        const [rows] = await conn.query(sql, params);
        return rows[0] ?? null;
      },
      async all(...params) {
        const [rows] = await conn.query(sql, params);
        return rows;
      },
      async run(...params) {
        await conn.query(sql, params);
      },
    };
  },
};

const [restaurants] = await conn.query(
  "SELECT id, name, cuisine_tags FROM restaurants WHERE source = 'osm' AND photo_url IS NULL",
);

if (restaurants.length === 0) {
  console.log('Every real restaurant already has a photo.');
  await conn.end();
  process.exit(0);
}

let updated = 0;
let skipped = 0;
for (const restaurant of restaurants) {
  const photo = await getOrCreateCuisinePhoto(db, restaurant.cuisine_tags);
  if (!photo) {
    console.log(`NO PHOTO: ${restaurant.name} (cuisine: ${restaurant.cuisine_tags})`);
    skipped++;
    continue;
  }
  await conn.query('UPDATE restaurants SET photo_url = ?, photo_attribution = ? WHERE id = ?', [
    photo.url,
    photo.attribution,
    restaurant.id,
  ]);
  console.log(`OK: ${restaurant.name} -> ${photo.url}`);
  updated++;
}

console.log(`\nUpdated ${updated}, skipped ${skipped} (of ${restaurants.length}).`);
await conn.end();
