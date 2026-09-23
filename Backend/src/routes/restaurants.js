import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { importCityRestaurants } from '../lib/osmPlaces.js';
import { requireFields } from '../lib/validate.js';
import { distanceKm, tastePrefsFor } from '../lib/taste.js';
import { pickRestaurantForGroup } from '../lib/ai.js';
import { friendIdsOf } from './friends.js';

export const restaurantsRouter = Router();

async function attachDishes(restaurant) {
  const dishes = toCamelRows(
    await db.prepare('SELECT * FROM dishes WHERE restaurant_id = ?').all(restaurant.id),
  );
  return { ...restaurant, dishes };
}

// Batched dish-attaching for a whole restaurant list -- one query total
// instead of one per restaurant. With Promise.all(rows.map(attachDishes))
// each restaurant fired its own query concurrently against a 10-connection
// pool; a city (or worse, an unfiltered list) with hundreds of restaurants
// meant hundreds of queries queuing for those 10 connections, turning a
// simple list into a multi-second wait. Grouping by restaurant_id in JS
// after one IN(...) query is the fix; `popularOnly` slices to 3 per
// restaurant in JS too, since "top 3 per group" isn't a plain SQL LIMIT.
async function attachDishesBatch(restaurants, { popularOnly = false } = {}) {
  if (restaurants.length === 0) return restaurants;
  const ids = restaurants.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const filterClause = popularOnly ? 'AND is_popular = 1' : '';
  const allDishes = toCamelRows(
    await db.prepare(`SELECT * FROM dishes WHERE restaurant_id IN (${placeholders}) ${filterClause}`).all(...ids),
  );
  const byRestaurantId = new Map();
  for (const dish of allDishes) {
    const list = byRestaurantId.get(dish.restaurantId) ?? [];
    list.push(dish);
    byRestaurantId.set(dish.restaurantId, list);
  }
  return restaurants.map((r) => {
    const dishes = byRestaurantId.get(r.id) ?? [];
    return { ...r, dishes: popularOnly ? dishes.slice(0, 3) : dishes };
  });
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

// Every dish across every restaurant (the "See All" behind Featured Dishes),
// featured ones first, then best rated. Public like /featured-dishes above.
restaurantsRouter.get('/dishes', asyncHandler(async (_req, res) => {
  const rows = await db
    .prepare(
      `SELECT d.*, r.name as restaurant_name FROM dishes d
       JOIN restaurants r ON r.id = d.restaurant_id
       ORDER BY d.is_featured DESC, d.rating DESC, d.name ASC
       LIMIT 500`,
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

// A real (if AI-free) personalization pass: scores every candidate on
// rating, overlap between the restaurant's cuisine_tags and the user's own
// Food Preferences (see food-preferences.page.ts -- same vocabulary,
// "Biryani"/"Karahi"/... is both a favorite-food chip and a cuisine tag),
// and distance from the user's real GPS position when they share one
// (falling back to their manually-set city otherwise, same as Discover).
restaurantsRouter.get('/recommended', requireAuth, asyncHandler(async (req, res) => {
  const { lat, lng, city } = req.query;
  const hasCoords = lat !== undefined && lng !== undefined && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  const userLat = hasCoords ? Number(lat) : null;
  const userLng = hasCoords ? Number(lng) : null;

  const myTaste = await tastePrefsFor(req.user.sub);
  const favoriteFoods = myTaste.favoriteFoods.map((food) => food.toLowerCase());

  // Real GPS already narrows "near me" better than a city string does, so
  // only city-scope the candidate pool when there are no coordinates to
  // sort by -- otherwise a good match just outside the city line would be
  // filtered out before distance ever gets a say.
  let effectiveCity = city;
  if (!hasCoords && !effectiveCity) {
    const myProfile = await db.prepare('SELECT city FROM user_profiles WHERE user_id = ?').get(req.user.sub);
    effectiveCity = myProfile?.city;
  }
  const rows = toCamelRows(
    effectiveCity && !hasCoords
      ? await db.prepare('SELECT * FROM restaurants WHERE city = ?').all(effectiveCity)
      : await db.prepare('SELECT * FROM restaurants').all(),
  );

  const scored = rows.map((restaurant) => {
    const cuisineTags = restaurant.cuisineTags ? restaurant.cuisineTags.split(',').map((tag) => tag.trim()) : [];
    const matchedFoods = cuisineTags.filter((tag) =>
      favoriteFoods.some((food) => tag.toLowerCase().includes(food) || food.includes(tag.toLowerCase())),
    );

    const distance =
      hasCoords && restaurant.latitude != null && restaurant.longitude != null
        ? distanceKm(userLat, userLng, Number(restaurant.latitude), Number(restaurant.longitude))
        : null;

    // Rating anchors quality (0-50), taste match rewards each distinct
    // favorite-food overlap (25 apiece), distance decays linearly to 0
    // by ~10km so a great match nearby still beats a great match far away.
    const ratingScore = (restaurant.rating ?? 0) * 10;
    const tasteScore = matchedFoods.length * 25;
    const distanceScore = distance !== null ? Math.max(0, 40 - distance * 4) : 0;

    const reasons = [];
    if (matchedFoods.length > 0) reasons.push(`Matches your love of ${matchedFoods[0]}`);
    if (distance !== null) reasons.push(`${Math.round(distance * 10) / 10} km away`);
    if (restaurant.rating !== null && restaurant.rating >= 4.7) reasons.push(`Top rated in ${restaurant.city}`);
    if (reasons.length === 0) reasons.push(`Known for ${cuisineTags[0] ?? 'great food'}`);

    return {
      ...restaurant,
      distanceKm: distance !== null ? Math.round(distance * 10) / 10 : null,
      matchedFoods,
      reasons,
      score: ratingScore + tasteScore + distanceScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  res.json({ restaurants: await attachDishesBatch(scored.slice(0, 10)) });
}));

// A real (when GEMINI_API_KEY is set) AI pick for a whole group, not
// just the caller -- see ai.js's pickRestaurantForGroup for how the model
// is kept to choosing only from a heuristically-scored shortlist. Members
// must be the caller's friends since this reads their food/dietary
// preferences, the same privacy boundary friend_requests already enforces
// on friends.js's own endpoints. Without a key configured, this still
// works -- it just returns the top heuristic candidate with a templated
// reason instead of a model-written one.
restaurantsRouter.post('/group-recommendation', requireAuth, asyncHandler(async (req, res) => {
  const memberIds = Array.isArray(req.body.memberIds)
    ? [...new Set(req.body.memberIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
  if (memberIds.length === 0) {
    return res.status(400).json({ message: 'Pick at least one friend to suggest a restaurant for the group.' });
  }

  const myFriendIds = new Set(await friendIdsOf(req.user.sub));
  const notFriends = memberIds.filter((id) => id !== req.user.sub && !myFriendIds.has(id));
  if (notFriends.length > 0) {
    return res.status(403).json({ message: 'You can only include friends in a group suggestion.' });
  }

  const allMemberIds = [...new Set([req.user.sub, ...memberIds])];
  const memberTastes = await Promise.all(allMemberIds.map((id) => tastePrefsFor(id)));
  const combinedFavoriteFoods = [...new Set(memberTastes.flatMap((t) => t.favoriteFoods.map((f) => f.toLowerCase())))];

  let effectiveCity = req.query.city;
  if (!effectiveCity) {
    const myProfile = await db.prepare('SELECT city FROM user_profiles WHERE user_id = ?').get(req.user.sub);
    effectiveCity = myProfile?.city;
  }
  const rows = toCamelRows(
    effectiveCity
      ? await db.prepare('SELECT * FROM restaurants WHERE city = ?').all(effectiveCity)
      : await db.prepare('SELECT * FROM restaurants').all(),
  );

  // Same rating+taste heuristic as /recommended above, just scored against
  // the whole group's combined favorite foods instead of one person's.
  const scored = rows
    .map((restaurant) => {
      const cuisineTags = restaurant.cuisineTags ? restaurant.cuisineTags.split(',').map((tag) => tag.trim()) : [];
      const matchedFoods = cuisineTags.filter((tag) =>
        combinedFavoriteFoods.some((food) => tag.toLowerCase().includes(food) || food.includes(tag.toLowerCase())),
      );
      return { ...restaurant, matchedFoods, score: (restaurant.rating ?? 0) * 10 + matchedFoods.length * 25 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (scored.length === 0) {
    return res.status(404).json({ message: 'No restaurants found nearby to suggest from.' });
  }

  const picked = await pickRestaurantForGroup({ candidates: scored, memberTastes });
  const fallback = scored[0];
  const restaurant = picked ? (scored.find((r) => r.id === picked.restaurantId) ?? fallback) : fallback;
  const reason =
    picked?.reason ||
    (restaurant.matchedFoods.length > 0
      ? `Matches the group's love of ${restaurant.matchedFoods[0]}`
      : `Highly rated${restaurant.rating ? ` (${restaurant.rating}★)` : ''}`);

  res.json({ restaurant: await attachDishes(restaurant), reason, aiPowered: !!picked });
}));

restaurantsRouter.get('/', asyncHandler(async (req, res) => {
  const { city, region, cuisine, priceTier, minPrice, maxPrice, minRating, query } = req.query;

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
    // Most OSM-imported restaurants have no genuine price_tier (see
    // migration 0004) -- this used to treat that as "not ruled out" and
    // fold every unpriced restaurant into every tier, which made "Under
    // 500" and "3000+" return practically the same list. Strict match
    // instead: only a restaurant with a real, known price_tier (seeded
    // curated picks, plus real restaurants back-filled from their actual
    // researched dish prices -- see Backend/scripts/seed-real-menus.mjs)
    // shows up under a specific tier.
    clauses.push('price_tier = ?');
    params.push(Number(priceTier));
  }
  // Same strict-match reasoning as priceTier above (see its comment): only a
  // restaurant with a real, known avg_price_pkr (see migration 0034) shows up
  // under a chosen range, rather than folding every unpriced restaurant into
  // every range.
  if (minPrice) {
    clauses.push('avg_price_pkr >= ?');
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    clauses.push('avg_price_pkr <= ?');
    params.push(Number(maxPrice));
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
  res.json({ restaurants: await attachDishesBatch(toCamelRows(rows), { popularOnly: true }) });
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
