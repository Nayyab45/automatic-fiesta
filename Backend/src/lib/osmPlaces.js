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
import { getOrCreateCuisinePhoto, getRealPlacePhoto } from './restaurantPhotos.js';

const USER_AGENT = 'WhatShouldWeEat-DevApp/1.0 (contact: nayyabashfaq05@gmail.com)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_PLACES_PER_CITY = 80;

function capitalize(word) {
  // OSM cuisine values are snake_case (e.g. "coffee_shop") -- render as words.
  return word
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  // Nominatim returns an HTML/plain-text error body (not JSON) on rate-limits
  // or outages -- parsing that as JSON would throw a confusing SyntaxError,
  // so surface the real HTTP failure instead.
  if (!response.ok) {
    throw new Error(`Nominatim lookup for "${city}" failed: ${response.status} ${response.statusText}`);
  }
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
  // Overpass returns an XML error document (not JSON) when it's rate-limiting
  // or rejecting the query -- same reasoning as the Nominatim check above.
  if (!response.ok) {
    throw new Error(`Overpass query failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return (data.elements || []).filter((element) => element.tags?.name);
}

/**
 * Imports a city's real restaurants from OpenStreetMap into the `restaurants`
 * table, unless it's already been imported before. `fetchBoundingBox`/
 * `fetchPlaces`/`fetchRealPhoto`/`fetchCuisinePhoto` are injectable so tests
 * can stub every network call out.
 */
export async function importCityRestaurants(
  db,
  city,
  {
    fetchBoundingBox = lookupCityBoundingBox,
    fetchPlaces = fetchOverpassRestaurants,
    fetchRealPhoto = getRealPlacePhoto,
    fetchCuisinePhoto = getOrCreateCuisinePhoto,
  } = {},
) {
  const alreadyImported = await db.prepare('SELECT 1 FROM restaurant_import_log WHERE city = ?').get(city);
  if (alreadyImported) {
    return { imported: 0, skipped: true };
  }

  // Deliberately NOT logged to restaurant_import_log below: that table means
  // "we asked OSM about this city and it had a real answer" (including zero
  // results), not "OSM was unreachable/rate-limited just now". Logging a
  // transient failure the same way would permanently skip the city, so a
  // caller that catches this should just fall back to whatever's already in
  // the DB and let the next request for this city try the import again.
  const bbox = await fetchBoundingBox(city);
  if (!bbox) {
    // Records the attempt so an unresolvable city name isn't re-queried on
    // every single request for it.
    await db.prepare('INSERT INTO restaurant_import_log (city, place_count) VALUES (?, 0)').run(city);
    return { imported: 0, skipped: false };
  }

  const places = await fetchPlaces(bbox);

  // Photos are fetched in parallel rather than one place at a time inside
  // the loop below -- a city can have 80 places but usually far fewer
  // *distinct* cuisines, and with up to a couple of network calls per photo,
  // doing this sequentially could turn a city's first load into a
  // multi-minute wait. Real per-place photos run in parallel across every
  // place; cuisine photos run in parallel across only the distinct cuisines
  // present, then get reused via this map instead of re-fetched per place.
  const realPhotos = await Promise.all(places.map((place) => fetchRealPhoto(place, place.tags)));
  const distinctCuisines = [...new Set(places.map((place) => cuisineTagsFrom(place.tags)))];
  const cuisinePhotos = new Map(
    await Promise.all(distinctCuisines.map(async (cuisine) => [cuisine, await fetchCuisinePhoto(db, cuisine)])),
  );

  for (const [index, place] of places.entries()) {
    const tags = place.tags;
    const cuisineTags = cuisineTagsFrom(tags);
    // A real photo of this exact place if OSM has one linked, otherwise a
    // cuisine-matched stock photo (both already enhanced -- see
    // restaurantPhotos.js) -- or null, which just means "no photo yet",
    // handled by the same placeholder the app already shows for that.
    const photo = realPhotos[index] ?? cuisinePhotos.get(cuisineTags);

    await db
      .prepare(
        `INSERT INTO restaurants (name, city, region, cuisine_tags, address, latitude, longitude, photo_url, photo_attribution, source, external_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'osm', ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), latitude = VALUES(latitude), longitude = VALUES(longitude),
           cuisine_tags = VALUES(cuisine_tags), address = VALUES(address),
           photo_url = VALUES(photo_url), photo_attribution = VALUES(photo_attribution)`,
      )
      .run(
        tags.name,
        city,
        bbox.region,
        cuisineTags,
        addressFrom(tags, city),
        place.lat,
        place.lon,
        photo?.url ?? null,
        photo?.attribution ?? null,
        `osm:${place.type}/${place.id}`,
      );
  }

  await db.prepare('INSERT INTO restaurant_import_log (city, place_count) VALUES (?, ?)').run(city, places.length);
  return { imported: places.length, skipped: false };
}
