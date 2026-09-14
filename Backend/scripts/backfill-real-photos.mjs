// One-off backfill: replaces each OSM-imported restaurant's generic
// cuisine-matched stock photo with a real photo of that exact place, tried
// in the same order as new imports (see fetchRealPhotoForPlace in
// osmPlaces.js): Google Places if GOOGLE_PLACES_API_KEY is set, then
// Wikipedia/Wikidata (free, no key). Restaurants neither source has a photo
// for are left on their existing photo -- already the Openverse "any pic"
// fallback -- so nothing regresses.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { getGooglePlacePhoto, getWikipediaPlacePhoto } from '../src/lib/restaurantPhotos.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const [restaurants] = await pool.query(
  `SELECT id, name, city, address FROM restaurants WHERE source = 'osm'`,
);

console.log(
  `${restaurants.length} OSM-imported restaurants to check` +
    (process.env.GOOGLE_PLACES_API_KEY ? ' against Google Places, then Wikipedia.' : ' against Wikipedia (no GOOGLE_PLACES_API_KEY set).'),
);

let matched = 0;
let unmatched = 0;

for (const restaurant of restaurants) {
  const photo = (await getGooglePlacePhoto(restaurant)) ?? (await getWikipediaPlacePhoto(restaurant));
  if (photo) {
    await pool.query('UPDATE restaurants SET photo_url = ?, photo_attribution = ? WHERE id = ?', [
      photo.url,
      photo.attribution,
      restaurant.id,
    ]);
    matched++;
    console.log(`  [found]    ${restaurant.name} (${restaurant.city}) -- ${photo.attribution}`);
  } else {
    unmatched++;
    console.log(`  [no match] ${restaurant.name} (${restaurant.city}) -- kept existing photo`);
  }
  // Polite pacing between requests rather than firing them all at once.
  await sleep(200);
}

console.log(`\nDone. ${matched} restaurants updated with a real photo, ${unmatched} kept their existing fallback photo.`);
await pool.end();
