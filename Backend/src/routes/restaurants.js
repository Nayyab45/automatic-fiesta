import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { importCityRestaurants } from '../lib/osmPlaces.js';
import { requireFields } from '../lib/validate.js';

export const restaurantsRouter = Router();

async function attachDishes(restaurant) {
  const dishes = toCamelRows(
    await db.prepare('SELECT * FROM dishes WHERE restaurant_id = ?').all(restaurant.id),
  );
  return { ...restaurant, dishes };
}

async function attachPopularDishes(restaurant) {
  const dishes = toCamelRows(
    await db
      .prepare('SELECT * FROM dishes WHERE restaurant_id = ? AND is_popular = 1 LIMIT 3')
      .all(restaurant.id),
  );
  return { ...restaurant, dishes };
}

// Order matters: these fixed segments must be registered before '/:id' so
// Express doesn't treat them as an :id value.
restaurantsRouter.get('/featured-dishes', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT d.*, r.name as restaurant_name FROM dishes d
       JOIN restaurants r ON r.id = d.restaurant_id
       WHERE d.is_featured = 1
       ORDER BY d.rating DESC`,
    )
    .all();
  res.json({ dishes: toCamelRows(rows) });
}));

restaurantsRouter.get('/saved', requireAuth, asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT r.* FROM restaurants r
       JOIN saved_restaurants s ON s.restaurant_id = r.id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
    )
    .all(req.user.sub);
  res.json({ restaurants: toCamelRows(rows) });
}));

restaurantsRouter.get('/recommended', requireAuth, asyncHandler(async (req, res) => {
  const rows = await db.prepare('SELECT * FROM restaurants ORDER BY rating DESC LIMIT 10').all();
  res.json({ restaurants: await Promise.all(toCamelRows(rows).map(attachDishes)) });
}));

restaurantsRouter.get('/', asyncHandler(async (req, res) => {
  const { city, region, cuisine, priceTier, minRating, query } = req.query;

  // First time this city is asked for, pull its real restaurants from
  // OpenStreetMap and cache them -- see importCityRestaurants for why this
  // only ever happens once per city. OSM's free/keyless services occasionally
  // rate-limit or error out; when that happens, log it and fall through to
  // serving whatever's already cached for this city (possibly nothing) rather
  // than 500ing the whole request -- the import will simply retry on the
  // city's next request since a transient failure isn't logged as "imported".
  if (city) {
    try {
      await importCityRestaurants(db, city);
    } catch (err) {
      console.error(`[restaurants] OSM import for "${city}" failed, serving cached results instead:`, err.message);
    }
  }

  const clauses = [];
  const params = [];
  if (city) {
    clauses.push('city = ?');
    params.push(city);
  }
  if (region) {
    clauses.push('region = ?');
    params.push(region);
  }
  if (cuisine) {
    // The UI lets a user pick more than one cuisine chip; the frontend sends
    // them comma-joined in one query param rather than repeating ?cuisine=.
    const cuisineList = String(cuisine).split(',').map((c) => c.trim()).filter(Boolean);
    if (cuisineList.length) {
      clauses.push(`(${cuisineList.map(() => 'cuisine_tags LIKE ?').join(' OR ')})`);
      params.push(...cuisineList.map((c) => `%${c}%`));
    }
  }
  if (priceTier) {
    // Restaurants imported from OpenStreetMap have no genuine price_tier (see
    // migration 0004) rather than a fabricated one -- treat "unknown" as "not
    // ruled out" so this filter doesn't hide almost every real restaurant.
    clauses.push('(price_tier = ? OR price_tier IS NULL)');
    params.push(Number(priceTier));
  }
  if (minRating) {
    clauses.push('(rating >= ? OR rating IS NULL)');
    params.push(Number(minRating));
  }
  if (query) {
    clauses.push('name LIKE ?');
    params.push(`%${query}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.prepare(`SELECT * FROM restaurants ${where} ORDER BY rating DESC`).all(...params);
  res.json({ restaurants: await Promise.all(toCamelRows(rows).map(attachPopularDishes)) });
}));

// Real (OSM-imported) cuisine_tags are freeform text from OpenStreetMap, not
// the curated cuisine names shown as filter chips -- so the frontend asks
// here for the tags that actually occur, instead of filtering by a hardcoded
// list that mostly wouldn't match anything.
restaurantsRouter.get('/cuisines', asyncHandler(async (req, res) => {
  const { city } = req.query;

  if (city) {
    try {
      await importCityRestaurants(db, city);
    } catch (err) {
      console.error(`[restaurants] OSM import for "${city}" failed, serving cached results instead:`, err.message);
    }
  }

  const where = city ? 'WHERE city = ?' : '';
  const rows = await db.prepare(`SELECT cuisine_tags FROM restaurants ${where}`).all(...(city ? [city] : []));

  const counts = new Map();
  for (const row of rows) {
    for (const tag of row.cuisine_tags.split(',').map((t) => t.trim()).filter(Boolean)) {
      // "Restaurant" is the fallback label for an untagged place (see
      // cuisineTagsFrom in osmPlaces.js), not a real cuisine -- not useful as
      // a filter chip.
      if (tag === 'Restaurant') continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const cuisines = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag]) => tag);

  res.json({ cuisines });
}));

restaurantsRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ message: 'Restaurant not found' });
  }
  res.json({ restaurant: await attachDishes(toCamel(row)) });
}));

// Keeps restaurants.rating/review_count as a genuine, real-user-driven
// figure instead of the null OSM import leaves it with (see migration 0004)
// or a seed value that never changes -- once anyone reviews a restaurant
// through the app, this recomputed average becomes the figure shown and used
// by the price/rating filters, everywhere else in this file.
async function recomputeRestaurantRating(restaurantId) {
  const { avgRating, reviewCount } = await db
    .prepare('SELECT AVG(rating) as avgRating, COUNT(*) as reviewCount FROM restaurant_reviews WHERE restaurant_id = ?')
    .get(restaurantId);
  const rating = reviewCount > 0 ? Math.round(avgRating * 10) / 10 : null;
  await db
    .prepare('UPDATE restaurants SET rating = ?, review_count = ? WHERE id = ?')
    .run(rating, reviewCount > 0 ? reviewCount : null, restaurantId);
}

// Public -- unlike a dining table's reviews (tables.js), a restaurant review
// is meant to be read by anyone deciding whether to go there, not just
// people who've already dined with this specific host.
restaurantsRouter.get('/:id/reviews', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT rr.*, u.name as reviewer_name FROM restaurant_reviews rr
       JOIN users u ON u.id = rr.reviewer_user_id
       WHERE rr.restaurant_id = ? ORDER BY rr.created_at DESC`,
    )
    .all(req.params.id);
  res.json({ reviews: toCamelRows(rows) });
}));

// Deliberately not gated on having attended a table at this restaurant --
// unlike table reviews, this is a standalone "rate any restaurant you've
// been to" feature, not tied to a hosted dining event. One review per user
// per restaurant; posting again edits it rather than erroring, so a user
// can update their mind without deleting and re-creating.
restaurantsRouter.post('/:id/reviews', requireAuth, asyncHandler(async (req, res) => {
  const restaurant = await db.prepare('SELECT id FROM restaurants WHERE id = ?').get(req.params.id);
  if (!restaurant) {
    return res.status(404).json({ message: 'Restaurant not found' });
  }

  const missing = requireFields(req.body, ['rating']);
  if (missing) {
    return res.status(400).json({ message: missing });
  }
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'rating must be a whole number from 1 to 5' });
  }
  const comment = req.body.comment || null;

  await db
    .prepare(
      `INSERT INTO restaurant_reviews (restaurant_id, reviewer_user_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = CURRENT_TIMESTAMP`,
    )
    .run(restaurant.id, req.user.sub, rating, comment);
  await recomputeRestaurantRating(restaurant.id);

  const review = await db
    .prepare(
      `SELECT rr.*, u.name as reviewer_name FROM restaurant_reviews rr
       JOIN users u ON u.id = rr.reviewer_user_id
       WHERE rr.restaurant_id = ? AND rr.reviewer_user_id = ?`,
    )
    .get(restaurant.id, req.user.sub);
  res.status(201).json({ review: toCamel(review) });
}));

restaurantsRouter.delete('/:id/reviews', requireAuth, asyncHandler(async (req, res) => {
  await db
    .prepare('DELETE FROM restaurant_reviews WHERE restaurant_id = ? AND reviewer_user_id = ?')
    .run(req.params.id, req.user.sub);
  await recomputeRestaurantRating(req.params.id);
  res.json({ deleted: true });
}));

restaurantsRouter.post('/:id/save', requireAuth, asyncHandler(async (req, res) => {
  const restaurant = await db.prepare('SELECT id FROM restaurants WHERE id = ?').get(req.params.id);
  if (!restaurant) {
    return res.status(404).json({ message: 'Restaurant not found' });
  }
  await db.prepare('INSERT IGNORE INTO saved_restaurants (user_id, restaurant_id) VALUES (?, ?)').run(
    req.user.sub,
    req.params.id,
  );
  res.json({ saved: true });
}));

restaurantsRouter.delete('/:id/save', requireAuth, asyncHandler(async (req, res) => {
  await db.prepare('DELETE FROM saved_restaurants WHERE user_id = ? AND restaurant_id = ?').run(
    req.user.sub,
    req.params.id,
  );
  res.json({ saved: false });
}));
