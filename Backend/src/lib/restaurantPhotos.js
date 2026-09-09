// Photos for real (OpenStreetMap-imported) restaurants -- see osmPlaces.js.
// Google's Places Photos API needs a billing-enabled account, and a paid
// stock-photo API needs a personal account/email on file, so this uses only
// sources that need neither:
//   1. The place's own photo, if OSM happens to have an `image` tag linked
//      to it (rare, but genuinely that exact restaurant when present).
//   2. Otherwise a photo from Openverse (openverse.org), a public search
//      engine for openly-licensed images -- fully anonymous, no account, no
//      API key -- matched to the restaurant's cuisine and reused across
//      every restaurant sharing that cuisine rather than fetched per
//      restaurant, since a cuisine-representative photo doesn't need to be
//      unique per place.
// Openverse serves Creative Commons-licensed photos, not royalty-free ones:
// most CC licenses require crediting the photographer wherever the photo is
// shown, so every photo here carries an `attribution` string alongside its
// URL, persisted with it and rendered in the UI next to the photo.
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

function publicUrlFor(filename) {
  return `${ASSET_BASE}/images/restaurants/${filename}`;
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
  } catch {
    // A missing/unreachable linked photo shouldn't fail the whole import --
    // the restaurant just falls back to a cuisine stock photo instead.
    return null;
  }
}

/** Openverse's own `attribution` field is already the correctly-formatted credit line for its license. */
async function searchOpenverseImage(query) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&page_size=1&orientation=landscape`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return null;
  const data = await response.json();
  const result = data.results?.[0];
  if (!result) return null;
  return { imageUrl: result.url, attribution: result.attribution };
}

async function downloadStockPhotoImage(cuisineTags) {
  const query = `${cuisineTags.split(',')[0]} restaurant food`;
  const found = await searchOpenverseImage(query);
  if (!found) return null;

  const response = await fetch(found.imageUrl);
  if (!response.ok) return null;
  return { buffer: Buffer.from(await response.arrayBuffer()), attribution: found.attribution };
}

/**
 * One enhanced stock photo per distinct cuisine string, cached in
 * `cuisine_stock_photos` so it's fetched from Openverse at most once ever,
 * then reused for every restaurant that shares that cuisine. `fetchImage` is
 * injectable so tests can stand in for the network call.
 */
export async function getOrCreateCuisinePhoto(
  db,
  cuisineTags,
  { fetchImage = downloadStockPhotoImage } = {},
) {
  const cached = await db.prepare('SELECT photo_url, attribution FROM cuisine_stock_photos WHERE cuisine = ?').get(cuisineTags);
  if (cached) return { url: cached.photo_url, attribution: cached.attribution };

  try {
    const result = await fetchImage(cuisineTags);
    if (!result) return null;

    const filename = `cuisine-${slugify(cuisineTags)}.jpg`;
    const url = await storeEnhanced(result.buffer, filename);

    await db
      .prepare(
        `INSERT INTO cuisine_stock_photos (cuisine, photo_url, attribution) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE photo_url = VALUES(photo_url), attribution = VALUES(attribution)`,
      )
      .run(cuisineTags, url, result.attribution);
    return { url, attribution: result.attribution };
  } catch {
    // A network hiccup or an empty Openverse result just means this
    // restaurant keeps the app's existing "no photo" placeholder.
    return null;
  }
}
