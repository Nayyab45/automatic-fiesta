// One-off: fills in contact_phone/contact_email/website (see migrations
// 0016_restaurant_contact_info.js and 0017_restaurant_website.js) for every
// restaurant that still has neither, using Google Places for a real phone
// number and a scrape of that restaurant's own website for an email (Google
// Places has no email field of its own) -- see
// src/lib/restaurantContactEnrichment.js for the actual lookup. Covers both
// hand-seeded restaurants and OSM imports too old to have picked up contact
// info on their own (backfill-restaurant-contact-from-osm.mjs already covers
// what OSM itself had tagged; this is the Google-sourced top-up on whatever
// that left missing).
//
// Requires GOOGLE_PLACES_API_KEY to be set -- without it every lookup is a
// no-op (see getGooglePlaceContact) and this script does nothing useful.
//
// Run with `node scripts/backfill-restaurant-contact-from-google.mjs`.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { enrichRestaurantContact } from '../src/lib/restaurantContactEnrichment.js';

if (!process.env.GOOGLE_PLACES_API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY is not set -- nothing to backfill. See .env.example.');
  process.exit(1);
}

const conn = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

const [restaurants] = await conn.query(
  `SELECT id, name, city, address FROM restaurants
   WHERE contact_phone IS NULL OR contact_email IS NULL
   ORDER BY name`,
);

if (restaurants.length === 0) {
  console.log('Every restaurant already has both a phone number and an email (or has already been checked).');
  await conn.end();
  process.exit(0);
}

console.log(`Checking ${restaurants.length} restaurant(s) missing contact info against Google Places...`);

let phoneCount = 0;
let emailCount = 0;

for (const restaurant of restaurants) {
  const { phone, email, website } = await enrichRestaurantContact(restaurant);
  if (!phone && !email) continue;

  await conn.query(
    `UPDATE restaurants SET
       contact_phone = COALESCE(contact_phone, ?),
       contact_email = COALESCE(contact_email, ?),
       website = COALESCE(website, ?)
     WHERE id = ?`,
    [phone, email, website, restaurant.id],
  );
  if (phone) phoneCount++;
  if (email) emailCount++;
  console.log(`  #${restaurant.id} ${restaurant.name}: ${phone ? 'phone found' : 'no phone'}, ${email ? 'email found' : 'no email'}`);
}

console.log(`Done. ${phoneCount} restaurant(s) got a phone number, ${emailCount} got an email.`);
await conn.end();
