import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';
import { requireFields } from '../lib/validate.js';

export const tablesRouter = Router();
export const seatRequestsRouter = Router();

tablesRouter.use(requireAuth);
seatRequestsRouter.use(requireAuth);

function guestCount(tableId) {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM table_guests WHERE table_id = ?').get(tableId);
  return 1 + count; // + host
}

function tableWithContext(row, userId) {
  const restaurant = db.prepare('SELECT name, photo_url, address, rating, cuisine_tags FROM restaurants WHERE id = ?').get(row.restaurant_id);
  const host = db.prepare('SELECT id, name FROM users WHERE id = ?').get(row.host_user_id);
  const hasReviewed = db
    .prepare('SELECT 1 FROM reviews WHERE table_id = ? AND reviewer_user_id = ?')
    .get(row.id, userId);

  return {
    ...toCamel(row),
    restaurant: toCamel(restaurant),
    host: toCamel(host),
    guestCount: guestCount(row.id),
    isPast: row.date_time < new Date().toISOString(),
    isHost: row.host_user_id === userId,
    hasReviewed: !!hasReviewed,
  };
}

tablesRouter.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT DISTINCT t.* FROM dining_tables t
       LEFT JOIN table_guests g ON g.table_id = t.id AND g.user_id = ?
       WHERE t.host_user_id = ? OR g.user_id = ?
       ORDER BY t.date_time DESC`,
    )
    .all(req.user.sub, req.user.sub, req.user.sub);

  res.json({ tables: rows.map((row) => tableWithContext(row, req.user.sub)) });
});

tablesRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ message: 'Table not found' });
  }
  res.json({ table: tableWithContext(row, req.user.sub) });
});

tablesRouter.post('/', (req, res) => {
  const { restaurantId, gatheringType, dateTime, seatsTotal, visibility, atmosphere, note, pricePerPerson, title } =
    req.body ?? {};

  const missingFieldsError = requireFields(req.body, ['restaurantId', 'gatheringType', 'dateTime', 'seatsTotal']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const restaurant = db.prepare('SELECT id, name FROM restaurants WHERE id = ?').get(restaurantId);
  if (!restaurant) {
    return res.status(404).json({ message: 'Restaurant not found' });
  }

  const result = db
    .prepare(
      `INSERT INTO dining_tables
       (title, restaurant_id, host_user_id, gathering_type, date_time, seats_total, visibility, atmosphere, note, price_per_person)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      title?.trim() || `${gatheringType} at ${restaurant.name}`,
      restaurantId,
      req.user.sub,
      gatheringType,
      dateTime,
      seatsTotal,
      visibility ?? 'public',
      atmosphere ?? null,
      note ?? null,
      pricePerPerson ?? null,
    );

  const created = db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ table: tableWithContext(created, req.user.sub) });
});

tablesRouter.get('/:id/guests', (req, res) => {
  const table = db.prepare('SELECT id, host_user_id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }

  const host = db.prepare('SELECT id, name FROM users WHERE id = ?').get(table.host_user_id);
  const guests = db
    .prepare(
      `SELECT u.id, u.name, g.role FROM table_guests g
       JOIN users u ON u.id = g.user_id
       WHERE g.table_id = ?
       ORDER BY g.joined_at ASC`,
    )
    .all(table.id);

  res.json({
    guests: [
      { ...toCamel(host), role: 'Host', isHost: true },
      ...toCamelRows(guests).map((g) => ({ ...g, isHost: false })),
    ],
  });
});

tablesRouter.post('/:id/seat-requests', (req, res) => {
  const table = db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (table.host_user_id === req.user.sub) {
    return res.status(400).json({ message: "You can't request a seat at your own table" });
  }

  const existing = db
    .prepare("SELECT id FROM seat_requests WHERE table_id = ? AND user_id = ? AND status = 'sent'")
    .get(table.id, req.user.sub);
  if (existing) {
    return res.status(409).json({ message: 'You already have a pending request for this table' });
  }

  const result = db
    .prepare('INSERT INTO seat_requests (table_id, user_id, message) VALUES (?, ?, ?)')
    .run(table.id, req.user.sub, req.body?.message ?? null);

  const created = db.prepare('SELECT * FROM seat_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ seatRequest: toCamel(created) });
});

tablesRouter.get('/:id/seat-requests/me', (req, res) => {
  const row = db
    .prepare(
      'SELECT * FROM seat_requests WHERE table_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
    )
    .get(req.params.id, req.user.sub);
  res.json({ seatRequest: row ? toCamel(row) : null });
});

tablesRouter.post('/:id/check-in', (req, res) => {
  const table = db.prepare('SELECT id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  db.prepare('INSERT OR IGNORE INTO check_ins (table_id, user_id) VALUES (?, ?)').run(table.id, req.user.sub);
  const row = db.prepare('SELECT * FROM check_ins WHERE table_id = ? AND user_id = ?').get(table.id, req.user.sub);
  res.json({ checkIn: toCamel(row) });
});

tablesRouter.post('/:id/check-out', (req, res) => {
  db.prepare(
    "UPDATE check_ins SET checked_out_at = datetime('now') WHERE table_id = ? AND user_id = ? AND checked_out_at IS NULL",
  ).run(req.params.id, req.user.sub);
  const row = db.prepare('SELECT * FROM check_ins WHERE table_id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  res.json({ checkIn: row ? toCamel(row) : null });
});

tablesRouter.get('/:id/check-in/me', (req, res) => {
  const row = db.prepare('SELECT * FROM check_ins WHERE table_id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  res.json({ checkIn: row ? toCamel(row) : null });
});

tablesRouter.post('/:id/reviews', (req, res) => {
  const table = db.prepare('SELECT id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }

  const existing = db
    .prepare('SELECT id FROM reviews WHERE table_id = ? AND reviewer_user_id = ?')
    .get(table.id, req.user.sub);
  if (existing) {
    return res.status(409).json({ message: 'You already reviewed this table' });
  }

  const { foodRating, restaurantRating, conversationRating, overallRating, dineAgain, comment } = req.body ?? {};
  const result = db
    .prepare(
      `INSERT INTO reviews
       (table_id, reviewer_user_id, food_rating, restaurant_rating, conversation_rating, overall_rating, dine_again, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      table.id,
      req.user.sub,
      foodRating ?? null,
      restaurantRating ?? null,
      conversationRating ?? null,
      overallRating ?? null,
      dineAgain ?? null,
      comment ?? null,
    );

  const created = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ review: toCamel(created) });
});

// Mounted separately at /api/seat-requests since it acts on a seat request
// by its own id, not scoped under a table.
seatRequestsRouter.patch('/:id', (req, res) => {
  const { status } = req.body ?? {};
  if (!['confirmed', 'declined'].includes(status)) {
    return res.status(400).json({ message: "status must be 'confirmed' or 'declined'" });
  }

  const seatRequest = db.prepare('SELECT * FROM seat_requests WHERE id = ?').get(req.params.id);
  if (!seatRequest) {
    return res.status(404).json({ message: 'Seat request not found' });
  }

  const table = db.prepare('SELECT host_user_id FROM dining_tables WHERE id = ?').get(seatRequest.table_id);
  if (table.host_user_id !== req.user.sub) {
    return res.status(403).json({ message: 'Only the host can review this request' });
  }

  db.prepare("UPDATE seat_requests SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    seatRequest.id,
  );

  if (status === 'confirmed') {
    db.prepare('INSERT OR IGNORE INTO table_guests (table_id, user_id) VALUES (?, ?)').run(
      seatRequest.table_id,
      seatRequest.user_id,
    );
  }

  const updated = db.prepare('SELECT * FROM seat_requests WHERE id = ?').get(seatRequest.id);
  res.json({ seatRequest: toCamel(updated) });
});
