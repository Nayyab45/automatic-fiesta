// Photos for restaurants, tried in order from most to least specific:
//   1. Google Places (getGooglePlacePhoto below), if GOOGLE_PLACES_API_KEY is
//      set -- a real photo of this exact restaurant, sourced the same way
//      Google Maps shows it. Needs a billing-enabled Google Cloud project,
//      so it's opt-in rather than assumed.
//   2. The place's own photo, if OSM happens to have an `image` tag linked
//      to it (rare, but genuinely that exact restaurant when present).
//   3. A Wikipedia/Wikidata photo (getWikipediaPlacePhoto below), for the
//      rare restaurant notable enough to have its own entry -- free and
//      keyless, unlike Google.
//   4. Otherwise a photo from Openverse (openverse.org), a public search
//      engine for openly-licensed images -- fully anonymous, no account, no
//      API key -- matched to the restaurant's cuisine. Multiple distinct
//      photos are cached per cuisine (a "pool", see getOrCreateCuisinePhoto)
//      and spread across the restaurants that share it, so e.g. two pizza
//      places don't render the exact same photo.
// Both Openverse and Google photos carry licensing/usage terms that require
// crediting the source wherever the photo is shown, so every photo here
// carries an `attribution` string alongside its URL, persisted with it and
// rendered in the UI next to the photo.
// Every photo that comes in is also run through enhancePhoto() before being
// stored, so photos from different sources still look like they belong to
// the same app.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jimp } from 'jimp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '..', 'assets', 'images', 'restaurants');
const ASSET_BASE = process.env.PUBLIC_ASSET_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const USER_AGENT = 'WhatShouldWeEat-DevApp/1.0 (contact: nayyabashfaq05@gmail.com)';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const GOOGLE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const GOOGLE_PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';
const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
const COMMONS_FILEPATH_URL = 'https://commons.wikimedia.org/wiki/Special:FilePath';
// Wikidata search results include a short description ("restaurant in
// Lahore, Pakistan", "fast food chain", ...) -- requiring one of these words
// in it is what keeps a name-only search from matching an unrelated
// same-named article (e.g. "Okra" the vegetable instead of the restaurant).
const RESTAURANT_DESCRIPTION_HINTS = ['restaurant', 'fast food', 'eatery', 'diner', 'coffeehouse', 'chain of restaurants'];

function publicUrlFor(filename) {
  return `${ASSET_BASE}/images/restaurants/${filename}`;
}

// How many distinct pool slots a cuisine shared by `count` restaurants
// should get: roughly one photo per 5 restaurants, capped at 15 so a huge
// cuisine group (e.g. a generic "Restaurant" fallback tag) doesn't trigger
// dozens of Openverse calls.
const MAX_RESTAURANTS_PER_PHOTO = 5;
const MAX_POOL_SIZE = 15;
export function poolSizeForCount(count) {
  return Math.min(MAX_POOL_SIZE, Math.max(1, Math.ceil(count / MAX_RESTAURANTS_PER_PHOTO)));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Crops to a consistent landscape ratio (matching the app's restaurant card
 * layout) and applies a warm color grade -- a contrast lift plus a gentle
 * saturation/hue push toward the app's brown-and-gold theme -- so photos
 * pulled from different sources still look like they belong to the same app.
 */
export async function enhancePhoto(buffer) {
  const image = await Jimp.fromBuffer(buffer);
  image.cover({ w: 800, h: 600 });
  image.contrast(0.08);
  image.color([
    { apply: 'saturate', params: [12] },
    { apply: 'hue', params: [6] },
  ]);
  return image.getBuffer('image/jpeg');
}

async function storeEnhanced(rawBuffer, filename) {
  const enhanced = await enhancePhoto(rawBuffer);
  await mkdir(IMAGES_DIR, { recursive: true });
  await writeFile(path.join(IMAGES_DIR, filename), enhanced);
  return publicUrlFor(filename);
}

/**
 * Downloads the image an OSM `image` tag points to, if present. There's no
 * license metadata for an arbitrary linked URL, so this is credited to
 * OpenStreetMap's contributors generally (same as the app's map tiles)
 * rather than claiming a specific verified license.
 */
async function downloadRealPlaceImage(tags) {
  if (!tags.image) return null;
  const response = await fetch(tags.image);
  if (!response.ok) return null;
  return { buffer: Buffer.from(await response.arrayBuffer()), attribution: 'Photo via OpenStreetMap contributors' };
}

/**
 * A real photo of this exact place, if OSM has one linked. Null otherwise.
 * `fetchImage` is injectable so tests can stand in for the network call.
 */
export async function getRealPlacePhoto(place, tags, { fetchImage = downloadRealPlaceImage } = {}) {
  try {
    const result = await fetchImage(tags);
    if (!result) return null;

    const filename = `osm-${place.type}-${place.id}.jpg`;
    const url = await storeEnhanced(result.buffer, filename);
    return { url, attribution: result.attribution };
  } catch (err) {
    // A missing/unreachable linked photo shouldn't fail the whole import --
    // the restaurant just falls back to a cuisine stock photo instead.
    console.error(`[restaurantPhotos] getRealPlacePhoto failed for ${place?.type}/${place?.id}:`, err.message);
    return null;
  }
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * A real photo of this exact restaurant from Google Places, if
 * GOOGLE_PLACES_API_KEY is set and Google has both a matching place and a
 * photo for it. Null otherwise (no key configured, no match found, or the
 * match has no photo) -- callers fall back to OSM/Openverse in that case.
 * `fetchImpl` is injectable so tests can stand in for the network calls.
 */
export async function getGooglePlacePhoto(restaurant, { fetchImpl = fetch } = {}) {
  if (!GOOGLE_PLACES_API_KEY) return null;

  try {
    const query = `${restaurant.name}, ${restaurant.address || restaurant.city}`;
    const findUrl = `${GOOGLE_FIND_PLACE_URL}?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${GOOGLE_PLACES_API_KEY}`;
    const findResponse = await fetchImpl(findUrl);
    if (!findResponse.ok) return null;
    const findData = await findResponse.json();
    const placeId = findData.candidates?.[0]?.place_id;
    if (!placeId) return null;

    const detailsUrl = `${GOOGLE_DETAILS_URL}?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
    const detailsResponse = await fetchImpl(detailsUrl);
    if (!detailsResponse.ok) return null;
    const detailsData = await detailsResponse.json();
    const photo = detailsData.result?.photos?.[0];
    if (!photo?.photo_reference) return null;

    const photoUrl = `${GOOGLE_PHOTO_URL}?maxwidth=1000&photo_reference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
    const photoResponse = await fetchImpl(photoUrl);
    if (!photoResponse.ok) return null;
    const buffer = Buffer.from(await photoResponse.arrayBuffer());

    const filename = `google-${slugify(restaurant.name)}-${restaurant.id ?? Date.now()}.jpg`;
    const url = await storeEnhanced(buffer, filename);
    const credit = photo.html_attributions?.[0] ? stripHtml(photo.html_attributions[0]) : null;
    return { url, attribution: credit ? `Photo via Google (${credit})` : 'Photo via Google' };
  } catch (err) {
    // A network hiccup, no match, or a match with no photo all just mean
    // this restaurant falls through to the OSM/Openverse fallback instead.
    console.error(`[restaurantPhotos] getGooglePlacePhoto failed for "${restaurant?.name}":`, err.message);
    return null;
  }
}

/** The QID of a Wikidata item that's plausibly this restaurant, or null if nothing matches well enough. */
async function searchWikidataRestaurant(name) {
  const url = `${WIKIDATA_API_URL}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&type=item&limit=5&origin=*`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return null;
  const data = await response.json();
  const candidate = (data.search || []).find((entry) =>
    RESTAURANT_DESCRIPTION_HINTS.some((hint) => entry.description?.toLowerCase().includes(hint)),
  );
  return candidate?.id ?? null;
}

/** The Commons filename in a Wikidata item's "image" (P18) statement, or null if it has none. */
async function getWikidataImageFilename(qid) {
  const response = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const imageClaim = data.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return imageClaim ?? null;
}

/**
 * A real photo of this exact restaurant from Wikipedia/Wikidata, for the
 * (rare) case it's notable enough to have an entry -- free, keyless, no
 * billing account, unlike Google Places. Null if no well-matched entity is
 * found, or it has no linked image.
 */
export async function getWikipediaPlacePhoto(restaurant) {
  try {
    const qid = await searchWikidataRestaurant(restaurant.name);
    if (!qid) return null;
    const filename = await getWikidataImageFilename(qid);
    if (!filename) return null;

    const photoUrl = `${COMMONS_FILEPATH_URL}/${encodeURIComponent(filename)}?width=1000`;
    const photoResponse = await fetch(photoUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!photoResponse.ok) return null;
    // Commons files aren't all photos -- an SVG logo/map would break Jimp's
    // decoder, so only follow through on an actual raster image.
    const contentType = photoResponse.headers.get('content-type') || '';
    if (!contentType.startsWith('image/') || contentType.includes('svg')) return null;
    const buffer = Buffer.from(await photoResponse.arrayBuffer());

    const outFilename = `wikidata-${slugify(restaurant.name)}-${restaurant.id ?? Date.now()}.jpg`;
    const url = await storeEnhanced(buffer, outFilename);
    return { url, attribution: 'Photo via Wikimedia Commons' };
  } catch (err) {
    console.error(`[restaurantPhotos] getWikipediaPlacePhoto failed for "${restaurant?.name}":`, err.message);
    return null;
  }
}

// Openverse's keyword search has no "country" filter, so a query like
// "chicken restaurant food" happily surfaces a Hong Kong Wikimedia
// contributor's photo captioned in Chinese just because it also contains
// the words "chicken", "restaurant" and "food" -- wildly mismatched for an
// app about Pakistani dining. Any candidate whose attribution is written in
// (or names a place in) East Asia is rejected below and the search moves on
// to the next one instead.
const CJK_SCRIPT_REGEX = /[぀-ヿ㐀-䶿一-鿿가-힯]/;
const EAST_ASIAN_PLACE_HINTS = [
  'china',
  'chinese',
  'hong kong',
  'hongkong',
  'japan',
  'japanese',
  'tokyo',
  'osaka',
  'kyoto',
  'beijing',
  'shanghai',
  'korea',
  'korean',
  'seoul',
  'taiwan',
  'taipei',
  'sushi',
  'sashimi',
  'ramen',
  'tempura',
  'teriyaki',
  'dim sum',
];

export function looksEastAsian(text) {
  if (!text) return false;
  if (CJK_SCRIPT_REGEX.test(text)) return true;
  const lower = text.toLowerCase();
  return EAST_ASIAN_PLACE_HINTS.some((hint) => lower.includes(hint));
}

// OSM cuisine tags that don't name an actual dish ("Restaurant", "Regional",
// ...) searched literally just pull arbitrary restaurant interior/frontage
// photos from anywhere in the world. "Pakistani food dish" is a far more
// on-brand default for this app than a blind "restaurant food" search, and
// "dish" over "restaurant"/"food" generally biases results toward a plated
// close-up shot rather than a storefront that might carry foreign signage.
const GENERIC_CUISINE_TAGS = new Set(['restaurant', 'regional', 'cafe/diner', 'fast food', 'food court', 'coffee shop']);

function dishSearchQueryFor(cuisineTags) {
  const primary = cuisineTags.split(',')[0].trim();
  const subject = GENERIC_CUISINE_TAGS.has(primary.toLowerCase()) ? 'Pakistani' : primary;
  return `${subject} food dish`;
}

/**
 * Openverse's own `attribution` field is already the correctly-formatted
 * credit line for its license. `page` picks a different result than earlier
 * pages searched for the same query, which is how distinct pool slots (see
 * getOrCreateCuisinePhoto) end up with visually different photos instead of
 * the same top hit every time.
 */
export async function searchOpenverseImage(query, page = 1) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&page_size=1&page=${page}&orientation=landscape`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return null;
  const data = await response.json();
  const result = data.results?.[0];
  if (!result) return null;
  return { imageUrl: result.url, attribution: result.attribution };
}

// `slot` gets its own block of pages (well clear of neighboring slots' own
// retry attempts) so a slot that has to skip a few East-Asian mismatches
// before finding a good candidate never lands on the same page -- and thus
// the same photo -- as a different slot.
const PAGES_PER_SLOT = 8;
const FALLBACK_QUERY = 'Pakistani food dish';

export async function findAcceptablePhoto(query, basePage) {
  for (let attempt = 0; attempt < PAGES_PER_SLOT; attempt++) {
    const found = await searchOpenverseImage(query, basePage + attempt);
    if (!found) return null; // search exhausted, nothing left to try
    if (looksEastAsian(found.attribution)) continue;

    const response = await fetch(found.imageUrl);
    if (!response.ok) continue;
    return { buffer: Buffer.from(await response.arrayBuffer()), attribution: found.attribution };
  }
  return null;
}

async function downloadStockPhotoImage(cuisineTags, slot = 0) {
  const basePage = slot * PAGES_PER_SLOT + 1;
  const query = dishSearchQueryFor(cuisineTags);
  const primaryResult = await findAcceptablePhoto(query, basePage);
  if (primaryResult) return primaryResult;

  // Some cuisines' genuine photos on Openverse are disproportionately
  // captioned in Chinese/Korean by the contributors who took them (e.g.
  // "Chinese", "Thai", "Asian" -- Hong Kong Wikimedia contributors are a
  // major source there), so the filtered search above can come up
  // completely empty for them. A generic Pakistani food photo is a safer,
  // more on-brand default for this app than leaving the restaurant with no
  // photo at all.
  if (query === FALLBACK_QUERY) return null;
  return findAcceptablePhoto(FALLBACK_QUERY, basePage);
}

/**
 * The `slot`-th distinct stock photo cached for this cuisine (0-indexed),
 * fetching and caching a new one from Openverse the first time that slot is
 * asked for for. Callers pick how many slots to spread a cuisine's
 * restaurants across (e.g. `restaurantIndex % poolSize` -- see osmPlaces.js
 * and scripts/diversify-restaurant-photos.mjs) so restaurants sharing a
 * cuisine don't all render the identical photo. `fetchImage` is injectable
 * so tests can stand in for the network call.
 */
export async function getOrCreateCuisinePhoto(db, cuisineTags, slot = 0, { fetchImage = downloadStockPhotoImage } = {}) {
  const rows = await db
    .prepare('SELECT photo_url, attribution FROM cuisine_stock_photos WHERE cuisine = ? ORDER BY id')
    .all(cuisineTags);
  if (rows[slot]) return { url: rows[slot].photo_url, attribution: rows[slot].attribution };

  try {
    const result = await fetchImage(cuisineTags, slot);
    if (!result) {
      // Nothing new at this slot (rate-limited or an exhausted search) --
      // reuse whatever's already cached for this cuisine rather than
      // leaving this restaurant with no photo at all.
      return rows[0] ? { url: rows[0].photo_url, attribution: rows[0].attribution } : null;
    }

    const filename = `cuisine-${slugify(cuisineTags)}-${slot}.jpg`;
    const url = await storeEnhanced(result.buffer, filename);
    await db
      .prepare('INSERT INTO cuisine_stock_photos (cuisine, photo_url, attribution) VALUES (?, ?, ?)')
      .run(cuisineTags, url, result.attribution);
    return { url, attribution: result.attribution };
  } catch (err) {
    console.error(`[restaurantPhotos] getOrCreateCuisinePhoto failed for "${cuisineTags}" slot ${slot}:`, err.message);
    return rows[0] ? { url: rows[0].photo_url, attribution: rows[0].attribution } : null;
  }
}
