import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';

export const restaurantsRouter = Router();

function attachDishes(restaurant) {
  const dishes = toCamelRows(
    db.prepare('SELECT * FROM dishes WHERE restaurant_id = ?').all(restaurant.id),
  );
  return { ...restaurant, dishes };
}

function attachPopularDishes(restaurant) {
  const dishes = toCamelRows(
    db
      .prepare('SELECT * FROM dishes WHERE restaurant_id = ? AND is_popular = 1 LIMIT 3')
      .all(restaurant.id),
  );
  return { ...restaurant, dishes };
}

// Order matters: these fixed segments must be registered before '/:id' so
// Express doesn't treat them as an :id value.
restaurantsRouter.get('/featured-dishes', (req, res) => {
  const rows = db
    .prepare(
      `SELECT d.*, r.name as restaurant_name FROM dishes d
       JOIN restaurants r ON r.id = d.restaurant_id
       WHERE d.is_featured = 1
       ORDER BY d.rating DESC`,
    )
    .all();
  res.json({ dishes: toCamelRows(rows) });
});

restaurantsRouter.get('/saved', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.* FROM restaurants r
       JOIN saved_restaurants s ON s.restaurant_id = r.id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
    )
    .all(req.user.sub);
  res.json({ restaurants: toCamelRows(rows) });
});

restaurantsRouter.get('/recommended', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM restaurants ORDER BY rating DESC LIMIT 10').all();
  res.json({ restaurants: toCamelRows(rows).map(attachDishes) });
});

restaurantsRouter.get('/', (req, res) => {
  const { city, region, cuisine, priceTier, minRating, query } = req.query;

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
    clauses.push('cuisine_tags LIKE ?');
    params.push(`%${cuisine}%`);
  }
  if (priceTier) {
    clauses.push('price_tier = ?');
    params.push(Number(priceTier));
  }
  if (minRating) {
    clauses.push('rating >= ?');
    params.push(Number(minRating));
  }
  if (query) {
    clauses.push('name LIKE ?');
    params.push(`%${query}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM restaurants ${where} ORDER BY rating DESC`).all(...params);
  res.json({ restaurants: toCamelRows(rows).map(attachPopularDishes) });
});

restaurantsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ message: 'Restaurant not found' });
  }
  res.json({ restaurant: attachDishes(toCamel(row)) });
});

restaurantsRouter.post('/:id/save', requireAuth, (req, res) => {
  const restaurant = db.prepare('SELECT id FROM restaurants WHERE id = ?').get(req.params.id);
  if (!restaurant) {
    return res.status(404).json({ message: 'Restaurant not found' });
  }
  db.prepare('INSERT OR IGNORE INTO saved_restaurants (user_id, restaurant_id) VALUES (?, ?)').run(
    req.user.sub,
    req.params.id,
  );
  res.json({ saved: true });
});

restaurantsRouter.delete('/:id/save', requireAuth, (req, res) => {
  db.prepare('DELETE FROM saved_restaurants WHERE user_id = ? AND restaurant_id = ?').run(
    req.user.sub,
    req.params.id,
  );
  res.json({ saved: false });
});
