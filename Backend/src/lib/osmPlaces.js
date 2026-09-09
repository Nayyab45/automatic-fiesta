// Fetches real restaurants/eateries for a city from OpenStreetMap the first
// time that city is requested, and caches them into the `restaurants` table
// (source='osm') so every later request is served from the DB like the
// hand-seeded ones. Free and keyless, unlike Google Places -- the same
// reasoning already used for map tiles (restaurant-direction.page.ts) and
// geocoding (scripts/geocode-restaurants.mjs).
//
// Deliberately one Nominatim call + one Overpass call per *city*, not per
// restaurant -- geocode-restaurants.mjs already notes these free public
// services are only "fine at this app's scale", and a per-restaurant lookup
// across every city in Pakistan would hammer a shared resource nobody here
// operates. `restaurant_import_log` makes sure a city is only ever fetched
// once, including cities OSM has zero tagged results for.
const USER_AGENT = 'WhatShouldWeEat-DevApp/1.0 (contact: nayyabashfaq05@gmail.com)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_PLACES_PER_CITY = 80;

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function cuisineTagsFrom(tags) {
  if (!tags.cuisine) return 'Restaurant';
  const parts = tags.cuisine
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map(capitalize);
  return parts.length ? parts.join(',') : 'Restaurant';
}

function addressFrom(tags, city) {
  const streetParts = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean);
  return streetParts.length ? `${streetParts.join(' ')}, ${city}` : null;
}

/** One Nominatim lookup for a city's bounding box + province ("state"). */
export async function lookupCityBoundingBox(city) {
  const url = `${NOMINATIM_URL}?format=json&limit=1&city=${encodeURIComponent(city)}&country=Pakistan&addressdetails=1`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const results = await response.json();
  if (!results.length) return null;

  const [south, north, west, east] = results[0].boundingbox.map(Number);
  return { south, north, west, east, region: results[0].address?.state || 'Pakistan' };
}

/** One Overpass query for restaurant-ish amenities within a bounding box. */
export async function fetchOverpassRestaurants(bbox) {
  const query = `
    [out:json][timeout:25];
    node["amenity"~"^(restaurant|fast_food|cafe|food_court)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    out ${MAX_PLACES_PER_CITY};
  `;
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'text/plain' },
    body: query,
  });
  const data = await response.json();
  return (data.elements || []).filter((element) => element.tags?.name);
}

/**
 * Imports a city's real restaurants from OpenStreetMap into the `restaurants`
 * table, unless it's already been imported before. `fetchBoundingBox`/
 * `fetchPlaces` are injectable so tests can stub the network calls out.
 */
export async function importCityRestaurants(
  db,
  city,
  { fetchBoundingBox = lookupCityBoundingBox, fetchPlaces = fetchOverpassRestaurants } = {},
) {
  const alreadyImported = await db.prepare('SELECT 1 FROM restaurant_import_log WHERE city = ?').get(city);
  if (alreadyImported) {
    return { imported: 0, skipped: true };
  }

  const bbox = await fetchBoundingBox(city);
  if (!bbox) {
    // Records the attempt so an unresolvable city name isn't re-queried on
    // every single request for it.
    await db.prepare('INSERT INTO restaurant_import_log (city, place_count) VALUES (?, 0)').run(city);
    return { imported: 0, skipped: false };
  }

  const places = await fetchPlaces(bbox);
  for (const place of places) {
    const tags = place.tags;
    await db
      .prepare(
        `INSERT INTO restaurants (name, city, region, cuisine_tags, address, latitude, longitude, source, external_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'osm', ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), latitude = VALUES(latitude), longitude = VALUES(longitude),
           cuisine_tags = VALUES(cuisine_tags), address = VALUES(address)`,
      )
      .run(
        tags.name,
        city,
        bbox.region,
        cuisineTagsFrom(tags),
        addressFrom(tags, city),
        place.lat,
        place.lon,
        `osm:${place.type}/${place.id}`,
      );
  }

  await db.prepare('INSERT INTO restaurant_import_log (city, place_count) VALUES (?, ?)').run(city, places.length);
  return { imported: places.length, skipped: false };
}
