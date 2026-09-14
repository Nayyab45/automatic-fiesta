// One-off backfill for restaurants imported before getOrCreateCuisinePhoto
// grew a photo *pool* per cuisine (see restaurantPhotos.js / osmPlaces.js):
// previously every restaurant sharing a cuisine rendered the exact same
// Openverse stock photo (151 restaurants all shared one "Restaurant" photo,
// 40 more had no photo at all after failed fetches). This spreads each
// cuisine's restaurants across a pool of a few distinct photos instead, the
// same poolSizeForCount formula new imports already use, so restaurants
// look varied rather than identical.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { getOrCreateCuisinePhoto, poolSizeForCount } from '../src/lib/restaurantPhotos.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

// Thin db.prepare(sql).get/all/run(...) adapter matching src/db.js, so
// getOrCreateCuisinePhoto (written against that shape) works unchanged here.
const db = {
  prepare(sql) {
    return {
      async get(...params) {
        const [rows] = await pool.query(sql, params);
        return rows[0] ?? null;
      },
      async all(...params) {
        const [rows] = await pool.query(sql, params);
        return rows;
      },
      async run(...params) {
        const [result] = await pool.query(sql, params);
        return { lastInsertRowid: result.insertId, changes: result.affectedRows };
      },
    };
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const [restaurants] = await pool.query(
  `SELECT id, name, cuisine_tags FROM restaurants WHERE source = 'osm' ORDER BY cuisine_tags, id`,
);

const byCuisine = new Map();
for (const restaurant of restaurants) {
  const group = byCuisine.get(restaurant.cuisine_tags) ?? [];
  group.push(restaurant);
  byCuisine.set(restaurant.cuisine_tags, group);
}

console.log(`${restaurants.length} OSM-imported restaurants across ${byCuisine.size} cuisine groups.`);

let updated = 0;

for (const [cuisineTags, group] of byCuisine) {
  const poolSize = poolSizeForCount(group.length);
  const photoPool = [];
  for (let slot = 0; slot < poolSize; slot++) {
    photoPool.push(await getOrCreateCuisinePhoto(db, cuisineTags, slot));
    await sleep(150);
  }

  for (const [index, restaurant] of group.entries()) {
    const photo = photoPool[index % poolSize];
    if (!photo) continue;
    await pool.query('UPDATE restaurants SET photo_url = ?, photo_attribution = ? WHERE id = ?', [
      photo.url,
      photo.attribution,
      restaurant.id,
    ]);
    updated++;
  }

  console.log(`  ${cuisineTags} -- ${group.length} restaurants spread across ${photoPool.filter(Boolean).length} photos`);
}

console.log(`\nDone. ${updated} restaurants updated.`);
await pool.end();
