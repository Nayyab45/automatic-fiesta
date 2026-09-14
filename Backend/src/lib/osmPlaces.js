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
import { getGooglePlacePhoto, getOrCreateCuisinePhoto, getRealPlacePhoto, getWikipediaPlacePhoto, poolSizeForCount } from './restaurantPhotos.js';

const USER_AGENT = 'WhatShouldWeEat-DevApp/1.0 (contact: nayyabashfaq05@gmail.com)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_PLACES_PER_CITY = 80;
// Plain fetch() has no timeout of its own -- a black-holed connection to
// either free service (same failure mode already fixed for the MySQL pool,
// see QUERY_TIMEOUT_MS in db.js) leaves the promise awaiting a response that
// never arrives, which hangs the whole /restaurants request (and the
// Discover page's "loading" state) indefinitely instead of falling through
// to the catch-and-serve-cached-results behavior the route already has.
const FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${new URL(url).host} timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

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
  // accept-language=en pins the province name in `address.state` to English
  // ("Punjab") -- without it Nominatim has been observed returning the local
  // script ("پنجاب") for the same province depending on the request, which
  // silently broke the app's region filter chips for every city imported
  // while it did.
  const url = `${NOMINATIM_URL}?format=json&limit=1&city=${encodeURIComponent(city)}&country=Pakistan&addressdetails=1&accept-language=en`;
  const response = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT } });
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
  const response = await fetchWithTimeout(OVERPASS_URL, {
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
 * A real photo of this exact place, cheapest/most-likely source first:
 * Google Places (if GOOGLE_PLACES_API_KEY is set), then OSM's own linked
 * `image` tag, then Wikipedia/Wikidata for the rare notable place. All three
 * are free to try when unmatched -- only Google costs anything, and only
 * when it actually finds a photo.
 */
async function fetchRealPhotoForPlace(place, tags, city) {
  const googlePhoto = await getGooglePlacePhoto({ name: tags.name, address: addressFrom(tags, city), city });
  if (googlePhoto) return googlePhoto;

  const osmPhoto = await getRealPlacePhoto(place, tags);
  if (osmPhoto) return osmPhoto;

  return getWikipediaPlacePhoto({ name: tags.name, city });
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
    fetchRealPhoto = (place, tags) => fetchRealPhotoForPlace(place, tags, city),
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
  // place. Cuisine photos build a small *pool* per cuisine (sized by how
  // many places share it -- see poolSizeForCount) instead of a single
  // shared photo, so e.g. ten pizza places don't all render the identical
  // image; slots within one cuisine are fetched sequentially (each one
  // depends on the last being cached first) but different cuisines' pools
  // build in parallel with each other.
  const realPhotos = await Promise.all(places.map((place) => fetchRealPhoto(place, place.tags)));
  const cuisineCounts = new Map();
  for (const place of places) {
    const cuisineTags = cuisineTagsFrom(place.tags);
    cuisineCounts.set(cuisineTags, (cuisineCounts.get(cuisineTags) ?? 0) + 1);
  }
  const cuisinePhotoPools = new Map(
    await Promise.all(
      [...cuisineCounts.entries()].map(async ([cuisineTags, count]) => {
        const poolSize = poolSizeForCount(count);
        const photos = [];
        for (let slot = 0; slot < poolSize; slot++) {
          photos.push(await fetchCuisinePhoto(db, cuisineTags, slot));
        }
        return [cuisineTags, photos];
      }),
    ),
  );

  const cuisineOccurrences = new Map();
  for (const [index, place] of places.entries()) {
    const tags = place.tags;
    const cuisineTags = cuisineTagsFrom(tags);
    const occurrence = cuisineOccurrences.get(cuisineTags) ?? 0;
    cuisineOccurrences.set(cuisineTags, occurrence + 1);
    const pool = cuisinePhotoPools.get(cuisineTags) ?? [];
    const cuisinePhoto = pool.length ? pool[occurrence % pool.length] : null;
    // A real photo of this exact place if OSM/Google/Wikipedia had one,
    // otherwise a cuisine-matched stock photo from this cuisine's pool
    // (both already enhanced -- see restaurantPhotos.js) -- or null, which
    // just means "no photo yet", handled by the app's existing placeholder.
    const photo = realPhotos[index] ?? cuisinePhoto;

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
