import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, pool } from '../src/db.js';
import { enhancePhoto, findAcceptablePhoto, getOrCreateCuisinePhoto } from '../src/lib/restaurantPhotos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '..', 'src', 'assets', 'images', 'dishes');
const ASSET_BASE = process.env.PUBLIC_ASSET_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Maps a dish name to a broader, more Openverse-friendly search category
// when the exact dish name (tried first) turns up nothing acceptable --
// same idea as dishSearchQueryFor() in restaurantPhotos.js, just keyed off
// the dish's own name instead of the restaurant's cuisine tag.
const CATEGORY_KEYWORDS = [
  [/burger|whopper|big mac/i, 'burger food'],
  [/pizza/i, 'pizza food'],
  [/biryani|pulao|rice/i, 'biryani rice food'],
  [/nihari|karahi|curry|handi/i, 'Pakistani curry food'],
  [/wings|nugget|fried chicken|drumstick|zinger|tender/i, 'fried chicken food'],
  [/kabab|kebab|sajji|tikka|bbq|roast|grill/i, 'BBQ grilled meat food'],
  [/fish/i, 'fried fish food'],
  [/naan|bread/i, 'naan bread food'],
  [/soup/i, 'soup food'],
  [/coffee|latte|cafe/i, 'coffee drink'],
  [/cake|dessert|mousse|flurry|sundae|pie|cone/i, 'dessert food'],
  [/fries|slaw|side/i, 'french fries food'],
  [/pasta|linguine|spaghetti/i, 'pasta food'],
  [/salmon|prawn|shrimp|seafood/i, 'seafood food'],
];

function fallbackQueryFor(dishName) {
  const hit = CATEGORY_KEYWORDS.find(([pattern]) => pattern.test(dishName));
  return hit ? hit[1] : 'Pakistani food dish';
}

async function storeDishPhoto(buffer, filename) {
  const enhanced = await enhancePhoto(buffer);
  await mkdir(IMAGES_DIR, { recursive: true });
  await writeFile(path.join(IMAGES_DIR, filename), enhanced);
  return `${ASSET_BASE}/images/dishes/${filename}`;
}

async function findPhotoFor(dishName) {
  // Try the exact dish name first (real, globally-documented items like
  // "Big Mac" or "Whopper" often have a genuine Openverse/Wikimedia photo);
  // fall back to a broader category query when that comes up empty.
  const primary = await findAcceptablePhoto(`${dishName} food`, 1);
  if (primary) return primary;
  const fallbackQuery = fallbackQueryFor(dishName);
  return findAcceptablePhoto(fallbackQuery, 20);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dishes = await db
  .prepare('SELECT d.id, d.name, r.cuisine_tags FROM dishes d JOIN restaurants r ON r.id = d.restaurant_id WHERE d.photo_url IS NULL')
  .all();
console.log(`${dishes.length} dish(es) with no photo yet`);

let fetched = 0;
let fromCuisinePool = 0;
let failed = 0;

for (const dish of dishes) {
  try {
    const found = await findPhotoFor(dish.name);
    if (found) {
      const filename = `dish-${slugify(dish.name)}-${dish.id}.jpg`;
      const url = await storeDishPhoto(found.buffer, filename);
      await db.prepare('UPDATE dishes SET photo_url = ?, photo_attribution = ? WHERE id = ?').run(url, found.attribution, dish.id);
      console.log(`✓ ${dish.name} -- real photo`);
      fetched++;
    } else {
      // Nothing found even after the fallback query -- reuse this
      // restaurant's own cuisine stock photo (already cached for most
      // restaurants) rather than leaving the dish with no photo at all.
      const cuisinePhoto = await getOrCreateCuisinePhoto(db, dish.cuisine_tags, 0);
      if (cuisinePhoto) {
        await db
          .prepare('UPDATE dishes SET photo_url = ?, photo_attribution = ? WHERE id = ?')
          .run(cuisinePhoto.url, cuisinePhoto.attribution, dish.id);
        console.log(`~ ${dish.name} -- cuisine stock photo (no dish-specific match)`);
        fromCuisinePool++;
      } else {
        console.log(`x ${dish.name} -- no photo found`);
        failed++;
      }
    }
  } catch (err) {
    console.log(`x ${dish.name} -- error: ${err.message}`);
    failed++;
  }
  await sleep(400); // be a reasonable citizen of Openverse's free API
}

console.log(`\nDone. ${fetched} real dish photos, ${fromCuisinePool} cuisine-pool fallbacks, ${failed} failed.`);
await pool.end();
