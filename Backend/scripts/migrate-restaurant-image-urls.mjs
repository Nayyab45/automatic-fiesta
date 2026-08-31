// One-off: the live DB was already seeded with the old
// lh3.googleusercontent.com URLs before download-restaurant-images.mjs and
// the seed-data change existed. seedRestaurants() only runs on an empty
// table, so it never touches those existing rows -- this updates them
// in place to match, keyed by name (restaurant/dish IDs and any rows that
// reference them are left untouched).
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { RESTAURANTS } from '../src/db/seed/restaurants.js';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

let restaurantsUpdated = 0;
let dishesUpdated = 0;

for (const restaurant of RESTAURANTS) {
  const [result] = await conn.query('UPDATE restaurants SET photo_url = ? WHERE name = ?', [restaurant.photoUrl, restaurant.name]);
  restaurantsUpdated += result.affectedRows;

  for (const dish of restaurant.dishes) {
    if (!dish.photoUrl) continue;
    const [dishResult] = await conn.query(
      `UPDATE dishes d JOIN restaurants r ON r.id = d.restaurant_id
       SET d.photo_url = ? WHERE r.name = ? AND d.name = ?`,
      [dish.photoUrl, restaurant.name, dish.name],
    );
    dishesUpdated += dishResult.affectedRows;
  }
}

console.log(`Updated ${restaurantsUpdated} restaurant photo_url row(s), ${dishesUpdated} dish photo_url row(s).`);
await conn.end();
