// One-off: looks up real latitude/longitude for every restaurant that
// doesn't have one yet, using OpenStreetMap's Nominatim geocoding API --
// free, no API key, no billing account needed (unlike Google's Geocoding
// API). Run with `node scripts/geocode-restaurants.mjs`.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires a real identifying User-Agent and caps requests at 1/second --
// both respected below. Fine for this app's ~12 restaurants; would need a
// self-hosted Nominatim instance or a paid provider before geocoding at
// real scale.
import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

const [restaurants] = await conn.query(
  'SELECT id, name, address, city, region FROM restaurants WHERE latitude IS NULL OR longitude IS NULL',
);

if (restaurants.length === 0) {
  console.log('Every restaurant already has coordinates.');
  await conn.end();
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let geocoded = 0;
let failed = 0;

for (const restaurant of restaurants) {
  const query = restaurant.address || `${restaurant.name}, ${restaurant.city}, ${restaurant.region}, Pakistan`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      // Required by Nominatim's usage policy -- identifies the app/contact
      // rather than looking like an anonymous scraper.
      'User-Agent': 'WhatShouldWeEat-DevApp/1.0 (contact: nayyabashfaq05@gmail.com)',
    },
  });
  const results = await response.json();

  if (results.length === 0) {
    console.log(`NO MATCH: ${restaurant.name} (query: "${query}")`);
    failed++;
  } else {
    const { lat, lon } = results[0];
    await conn.query('UPDATE restaurants SET latitude = ?, longitude = ? WHERE id = ?', [lat, lon, restaurant.id]);
    console.log(`OK: ${restaurant.name} -> ${lat}, ${lon}`);
    geocoded++;
  }

  await sleep(1100); // stay under Nominatim's 1 req/sec limit
}

console.log(`\nGeocoded ${geocoded}, failed ${failed} (of ${restaurants.length}).`);
await conn.end();
