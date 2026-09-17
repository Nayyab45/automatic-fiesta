// One-off: fills in contact_phone/contact_email (see migration
// 0016_restaurant_contact_info.js) for restaurants that were already
// imported from OpenStreetMap before osmPlaces.js started capturing those
// tags on import. Re-queries Overpass by the node ids already stored in
// external_id ("osm:node/<id>") rather than re-running a full per-city
// import, batched (not one request per restaurant) to stay polite to the
// free, shared Overpass API -- same reasoning as osmPlaces.js's one-query-
// per-city design.
// Run with `node scripts/backfill-restaurant-contact-from-osm.mjs`.
import 'dotenv/config';
import mysql from 'mysql2/promise';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'WhatShouldWeEat-DevApp/1.0 (contact: nayyabashfaq05@gmail.com)';
const BATCH_SIZE = 50;
const FETCH_TIMEOUT_MS = 40000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function contactFrom(tags) {
  return {
    phone: tags['contact:phone'] || tags.phone || null,
    email: tags['contact:email'] || tags.email || null,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Overpass's free shared instance rate-limits aggressively under load from
// every app that uses it, not just this one -- a 429 here means "try again
// later", not "this query is wrong", so it's worth a few patient retries
// (with backoff) rather than failing the whole backfill over a transient
// limit.
async function fetchTagsForIds(type, ids, attempt = 1) {
  const query = `[out:json][timeout:30];\n${type}(id:${ids.join(',')});\nout body;`;
  const response = await fetchWithTimeout(OVERPASS_URL, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'text/plain' },
    body: query,
  });
  if ((response.status === 429 || response.status === 504) && attempt <= 5) {
    const retryAfterSeconds = Number(response.headers.get('retry-after')) || attempt * 20;
    console.log(`Overpass returned ${response.status}, waiting ${retryAfterSeconds}s (attempt ${attempt}/5)...`);
    await sleep(retryAfterSeconds * 1000);
    return fetchTagsForIds(type, ids, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`Overpass query failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.elements || [];
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

// A pool, not a single connection -- Overpass's retry backoff above can
// leave this script idle for minutes at a stretch, long enough for a lone
// connection to be dropped by the DB server's own idle timeout. A pool
// transparently opens a fresh connection per query instead of holding one
// open the whole time.
const conn = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

const [restaurants] = await conn.query(
  `SELECT id, external_id FROM restaurants
   WHERE source = 'osm' AND external_id LIKE 'osm:%' AND contact_phone IS NULL AND contact_email IS NULL`,
);

if (restaurants.length === 0) {
  console.log('Every OSM-imported restaurant already has contact info (or has already been checked).');
  await conn.end();
  process.exit(0);
}

// external_id is always "osm:<type>/<id>" (see osmPlaces.js) -- grouped by
// type since Overpass's id: filter is type-specific (node(id:..) vs way(id:..)).
const byType = new Map();
for (const restaurant of restaurants) {
  const [, rest] = restaurant.external_id.split('osm:');
  const [type, osmId] = rest.split('/');
  if (!byType.has(type)) byType.set(type, []);
  byType.get(type).push({ ...restaurant, osmId });
}

let phoneCount = 0;
let emailCount = 0;
let checked = 0;

for (const [type, group] of byType) {
  for (const batch of chunk(group, BATCH_SIZE)) {
    if (checked > 0) await sleep(5000);
    const elements = await fetchTagsForIds(type, batch.map((r) => r.osmId));
    const tagsById = new Map(elements.map((el) => [String(el.id), el.tags || {}]));

    for (const restaurant of batch) {
      checked++;
      const tags = tagsById.get(restaurant.osmId);
      if (!tags) continue;
      const contact = contactFrom(tags);
      if (!contact.phone && !contact.email) continue;

      await conn.query('UPDATE restaurants SET contact_phone = ?, contact_email = ? WHERE id = ?', [
        contact.phone,
        contact.email,
        restaurant.id,
      ]);
      if (contact.phone) phoneCount++;
      if (contact.email) emailCount++;
    }
  }
}

console.log(`Checked ${checked} restaurant(s): ${phoneCount} got a phone number, ${emailCount} got an email from OSM.`);
await conn.end();
