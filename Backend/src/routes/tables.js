import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createNotification } from './messaging.js';
import { notifyRestaurantOfBooking } from '../lib/restaurantNotify.js';
import { requireAdmin } from '../lib/adminAuth.js';

export const tablesRouter = Router();
export const seatRequestsRouter = Router();

tablesRouter.use(requireAuth);
seatRequestsRouter.use(requireAuth);

async function guestCount(tableId) {
  const { count } = await db.prepare('SELECT COUNT(*) as count FROM table_guests WHERE table_id = ?').get(tableId);
  return 1 + count; // + host
}

async function isTableMember(table, userId) {
  if (table.host_user_id === userId) return true;
  return !!(await db.prepare('SELECT 1 FROM table_guests WHERE table_id = ? AND user_id = ?').get(table.id, userId));
}

const TABLE_AUDIENCES = ['everyone', 'women_only', 'friends_only'];

// Event creation is unlimited for every account. Exported so profileRouter's
// /me can surface this shape, the same way it already does for
// preferenceChangeStatus.
export async function tableCreationStatus() {
  return { unlimited: true, remaining: null, nextResetAt: null };
}

// A table's audience only restricts who may *discover or request a seat at*
// it -- the host and anyone already seated (table_guests) are always
// eligible for their own table regardless of audience, same as
// isTableMember above.
async function isEligibleForAudience(table, userId) {
  if (table.audience === 'everyone' || table.host_user_id === userId) return true;

  if (table.audience === 'women_only') {
    const profile = await db.prepare('SELECT gender FROM user_profiles WHERE user_id = ?').get(userId);
    return profile?.gender === 'woman';
  }

  if (table.audience === 'friends_only') {
    const friendship = await db
      .prepare(
        `SELECT 1 FROM friend_requests
         WHERE status = 'accepted'
           AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))`,
      )
      .get(userId, table.host_user_id, table.host_user_id, userId);
    return !!friendship;
  }

  return true;
}

async function tableWithContext(row, userId) {
  const restaurant = await db.prepare('SELECT name, photo_url, address, city, rating, cuisine_tags FROM restaurants WHERE id = ?').get(row.restaurant_id);
  const host = await db.prepare('SELECT id, name FROM users WHERE id = ?').get(row.host_user_id);
  const hasReviewed = await db
    .prepare('SELECT 1 FROM reviews WHERE table_id = ? AND reviewer_user_id = ?')
    .get(row.id, userId);

  const currentGuestCount = await guestCount(row.id);

  return {
    ...toCamel(row),
    restaurant: toCamel(restaurant),
    host: toCamel(host),
    guestCount: currentGuestCount,
    seatsAvailable: Math.max(row.seats_total - currentGuestCount, 0),
    isPast: row.date_time < new Date().toISOString(),
    isHost: row.host_user_id === userId,
    isMember: await isTableMember(row, userId),
    hasReviewed: !!hasReviewed,
    // Once the host records the real total (see PATCH /:id/bill), that's
    // split across whoever's actually seated right now -- takes over from
    // price_per_person, which was only ever an upfront estimate.
    pricePerPerson: row.total_bill != null ? Math.round((row.total_bill / currentGuestCount) * 100) / 100 : row.price_per_person,
  };
}

tablesRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT DISTINCT t.* FROM dining_tables t
       LEFT JOIN table_guests g ON g.table_id = t.id AND g.user_id = ?
       WHERE t.host_user_id = ? OR g.user_id = ?
       ORDER BY t.date_time DESC`,
    )
    .all(req.user.sub, req.user.sub, req.user.sub);

  res.json({ tables: await Promise.all(rows.map((row) => tableWithContext(row, req.user.sub))) });
}));

// Registered before '/:id' so Express doesn't swallow this as an :id value.
// Public tables hosted by other users, upcoming only, excluding ones the
// caller already hosts/has joined and excluding either direction of a block
// -- the same visibility rule people/matches already apply.
tablesRouter.get('/discover', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT t.* FROM dining_tables t
       WHERE t.visibility = 'public'
         AND t.host_user_id != ?
         AND t.date_time > ?
         AND t.id NOT IN (SELECT table_id FROM table_guests WHERE user_id = ?)
         AND t.host_user_id NOT IN (
           SELECT blocked_user_id FROM user_blocks WHERE blocker_user_id = ?
           UNION
           SELECT blocker_user_id FROM user_blocks WHERE blocked_user_id = ?
         )
       ORDER BY t.date_time ASC
       LIMIT 50`,
    )
    .all(req.user.sub, new Date().toISOString(), req.user.sub, req.user.sub, req.user.sub);

  // Filtered in JS rather than SQL: eligibility for 'women_only'/'friends_only'
  // needs a per-row lookup (the caller's gender, or their friendship with
  // that specific host) that doesn't reduce to a single WHERE clause the way
  // the block/visibility checks above do.
  const eligibleRows = [];
  for (const row of rows) {
    if (await isEligibleForAudience(row, req.user.sub)) eligibleRows.push(row);
  }

  res.json({ tables: await Promise.all(eligibleRows.map((row) => tableWithContext(row, req.user.sub))) });
}));

// Admin Meal/Event Management -- registered before '/:id' (same reasoning
// as '/discover' above) so Express doesn't swallow 'admin' as an :id value.
// Every event regardless of host/visibility/audience, most recent first, so
// an admin can find and remove an inappropriate one -- unlike every other
// route in this file, membership/audience eligibility doesn't apply here.
tablesRouter.get('/admin', requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await db
    .prepare(
      `SELECT t.*, u.name as host_name, r.name as restaurant_name FROM dining_tables t
       JOIN users u ON u.id = t.host_user_id
       JOIN restaurants r ON r.id = t.restaurant_id
       ORDER BY t.created_at DESC
       LIMIT 300`,
    )
    .all();
  res.json({ tables: toCamelRows(rows) });
}));

// Deletes an inappropriate event outright -- unlike a user's own account
// deletion (see auth.js's deleteUserAccount), there's no "leave the content
// behind" option here, since the event itself is the thing being removed.
// Manually cascades the same way that function does, since none of these
// tables declare a real FK (see db/schema/tables.js).
tablesRouter.delete('/admin/:id', requireAdmin, asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  await db.prepare('DELETE FROM table_messages WHERE table_id = ?').run(table.id);
  await db.prepare('DELETE FROM reviews WHERE table_id = ?').run(table.id);
  await db.prepare('DELETE FROM check_ins WHERE table_id = ?').run(table.id);
  await db.prepare('DELETE FROM seat_requests WHERE table_id = ?').run(table.id);
  await db.prepare('DELETE FROM table_guests WHERE table_id = ?').run(table.id);
  await db.prepare('DELETE FROM dining_tables WHERE id = ?').run(table.id);
  res.json({ ok: true });
}));

// Admin Reviews Management (the dining-table side -- see restaurants.js for
// the restaurant-review side of it). Every review regardless of who wrote
// it, most recent first.
tablesRouter.get('/admin/reviews', requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await db
    .prepare(
      `SELECT rv.*, u.name as reviewer_name, t.title as table_title FROM reviews rv
       JOIN users u ON u.id = rv.reviewer_user_id
       JOIN dining_tables t ON t.id = rv.table_id
       ORDER BY rv.created_at DESC
       LIMIT 300`,
    )
    .all();
  res.json({ reviews: toCamelRows(rows) });
}));

tablesRouter.delete('/admin/reviews/:id', requireAdmin, asyncHandler(async (req, res) => {
  await db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// Members can always see their own table's details. A non-member can only
// preview a public table they're eligible for (audience-wise) -- the same
// visibility a public table already has on GET /discover -- so someone can
// look before requesting a seat. A private table, or a public one whose
// audience excludes this caller, stays invisible to anyone who merely knows
// its numeric id.
tablesRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ message: 'Table not found' });
  }
  const canPreview = row.visibility === 'public' && (await isEligibleForAudience(row, req.user.sub));
  if (!(await isTableMember(row, req.user.sub)) && !canPreview) {
    return res.status(403).json({ message: 'Not a member of this table' });
  }
  res.json({ table: await tableWithContext(row, req.user.sub) });
}));

// Host records the real bill once it's known (typically after the meal) --
// tableWithContext then reports pricePerPerson as this split across
// whoever's currently seated, taking over from the upfront estimate.
// Re-settable (e.g. the host corrects a typo, or more guests join before
// the group actually pays) rather than a one-time write.
tablesRouter.patch('/:id/bill', asyncHandler(async (req, res) => {
  const row = await db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (row.host_user_id !== req.user.sub) {
    return res.status(403).json({ message: 'Only the host can set the bill for this table' });
  }

  const { totalBill } = req.body ?? {};
  if (typeof totalBill !== 'number' || !Number.isFinite(totalBill) || totalBill <= 0) {
    return res.status(400).json({ message: 'totalBill must be a positive number' });
  }

  await db.prepare('UPDATE dining_tables SET total_bill = ? WHERE id = ?').run(totalBill, row.id);
  const updated = await db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(row.id);
  res.json({ table: await tableWithContext(updated, req.user.sub) });
}));

// Popup-notifies every other user in the restaurant's city when a new
// *public* table is created there -- "near" here means same city, not real
// GPS distance, since the app has nowhere it persists a user's live location
// (only ever asked for it transiently, e.g. RestaurantService.recommended()).
// A private table stays private -- only its invited guests should ever hear
// about it. Same block-exclusion as GET /discover, so someone who's blocked
// the host (or been blocked by them) never gets pinged about their tables.
// Best-effort and never throws, same reasoning as notifyRestaurantOfBooking:
// a notification failure must not break the booking that triggered it.
async function notifyNearbyUsersOfNewTable(table, restaurant, hostUserId) {
  if (table.visibility !== 'public') return;

  const nearbyUsers = await db
    .prepare(
      `SELECT p.user_id FROM user_profiles p
       WHERE p.city = ? AND p.user_id != ?
         AND p.user_id NOT IN (
           SELECT blocked_user_id FROM user_blocks WHERE blocker_user_id = ?
           UNION
           SELECT blocker_user_id FROM user_blocks WHERE blocked_user_id = ?
         )
       LIMIT 500`,
    )
    .all(restaurant.city, hostUserId, hostUserId, hostUserId);

  const results = await Promise.allSettled(
    nearbyUsers.map((user) => createNotification(user.user_id, 'new_table_near_you', { tableId: table.id })),
  );
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[tables] failed to notify a nearby user of a new table:', result.reason?.message);
    }
  }
}

tablesRouter.post('/', asyncHandler(async (req, res) => {
  const { restaurantId, gatheringType, dateTime, seatsTotal, visibility, audience, atmosphere, note, pricePerPerson, title } =
    req.body ?? {};

  const missingFieldsError = requireFields(req.body, ['restaurantId', 'gatheringType', 'dateTime', 'seatsTotal']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  if (audience !== undefined && !TABLE_AUDIENCES.includes(audience)) {
    return res.status(400).json({ message: `audience must be one of: ${TABLE_AUDIENCES.join(', ')}` });
  }

  const restaurant = await db
    .prepare('SELECT id, name, city, contact_email, contact_phone FROM restaurants WHERE id = ?')
    .get(restaurantId);
  if (!restaurant) {
    return res.status(404).json({ message: 'Restaurant not found' });
  }

  const result = await db
    .prepare(
      `INSERT INTO dining_tables
       (title, restaurant_id, host_user_id, gathering_type, date_time, seats_total, visibility, audience, atmosphere, note, price_per_person)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      title?.trim() || `${gatheringType} at ${restaurant.name}`,
      restaurantId,
      req.user.sub,
      gatheringType,
      dateTime,
      seatsTotal,
      visibility ?? 'public',
      audience ?? 'everyone',
      atmosphere ?? null,
      note ?? null,
      pricePerPerson ?? null,
    );

  const created = await db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(result.lastInsertRowid);

  const host = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.sub);
  await notifyRestaurantOfBooking(restaurant, {
    hostName: host.name,
    gatheringType: created.gathering_type,
    dateTime: created.date_time,
    seatsTotal: created.seats_total,
  });
  await notifyNearbyUsersOfNewTable(created, restaurant, req.user.sub);

  res.status(201).json({ table: await tableWithContext(created, req.user.sub) });
}));

tablesRouter.get('/:id/guests', asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT id, host_user_id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }

  const host = await db.prepare('SELECT id, name FROM users WHERE id = ?').get(table.host_user_id);
  const guests = await db
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
}));

tablesRouter.post('/:id/seat-requests', asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (table.host_user_id === req.user.sub) {
    return res.status(400).json({ message: "You can't request a seat at your own table" });
  }
  if (!(await isEligibleForAudience(table, req.user.sub))) {
    const reason = table.audience === 'women_only' ? 'a women-only' : 'a friends-only';
    return res.status(403).json({ message: `This is ${reason} table you're not eligible to join` });
  }

  const existing = await db
    .prepare("SELECT id FROM seat_requests WHERE table_id = ? AND user_id = ? AND status = 'sent'")
    .get(table.id, req.user.sub);
  if (existing) {
    return res.status(409).json({ message: 'You already have a pending request for this table' });
  }

  const result = await db
    .prepare('INSERT INTO seat_requests (table_id, user_id, message) VALUES (?, ?, ?)')
    .run(table.id, req.user.sub, req.body?.message ?? null);

  await createNotification(table.host_user_id, 'seat_request_received', { tableId: table.id, actorUserId: req.user.sub });

  const created = await db.prepare('SELECT * FROM seat_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ seatRequest: toCamel(created) });
}));

tablesRouter.get('/:id/seat-requests/me', asyncHandler(async (req, res) => {
  const row = await db
    .prepare(
      'SELECT * FROM seat_requests WHERE table_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
    )
    .get(req.params.id, req.user.sub);
  res.json({ seatRequest: row ? toCamel(row) : null });
}));

// Host-only: every request made for this table, not just the caller's own
// (that's /:id/seat-requests/me above) -- lets the host review and act on
// the full queue instead of needing each request's id from a notification.
tablesRouter.get('/:id/seat-requests', asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT id, host_user_id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (table.host_user_id !== req.user.sub) {
    return res.status(403).json({ message: 'Only the host can view seat requests for this table' });
  }

  const rows = await db
    .prepare(
      `SELECT sr.*, u.name as user_name FROM seat_requests sr
       JOIN users u ON u.id = sr.user_id
       WHERE sr.table_id = ? ORDER BY sr.created_at DESC`,
    )
    .all(table.id);
  res.json({ seatRequests: toCamelRows(rows) });
}));

tablesRouter.post('/:id/check-in', asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT id, host_user_id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (!(await isTableMember(table, req.user.sub))) {
    return res.status(403).json({ message: 'Only the host or a confirmed guest can check in to this table' });
  }
  await db.prepare('INSERT IGNORE INTO check_ins (table_id, user_id) VALUES (?, ?)').run(table.id, req.user.sub);
  const row = await db.prepare('SELECT * FROM check_ins WHERE table_id = ? AND user_id = ?').get(table.id, req.user.sub);
  res.json({ checkIn: toCamel(row) });
}));

tablesRouter.post('/:id/check-out', asyncHandler(async (req, res) => {
  await db.prepare(
    'UPDATE check_ins SET checked_out_at = NOW() WHERE table_id = ? AND user_id = ? AND checked_out_at IS NULL',
  ).run(req.params.id, req.user.sub);
  const row = await db.prepare('SELECT * FROM check_ins WHERE table_id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  res.json({ checkIn: row ? toCamel(row) : null });
}));

tablesRouter.get('/:id/check-in/me', asyncHandler(async (req, res) => {
  const row = await db.prepare('SELECT * FROM check_ins WHERE table_id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  res.json({ checkIn: row ? toCamel(row) : null });
}));

tablesRouter.post('/:id/reviews', asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }

  const existing = await db
    .prepare('SELECT id FROM reviews WHERE table_id = ? AND reviewer_user_id = ?')
    .get(table.id, req.user.sub);
  if (existing) {
    return res.status(409).json({ message: 'You already reviewed this table' });
  }

  const { foodRating, restaurantRating, conversationRating, overallRating, dineAgain, comment } = req.body ?? {};
  const result = await db
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

  const created = await db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ review: toCamel(created) });
}));

// Table members only, mirroring /:id/messages below -- a review's comment
// is about a specific private dining event, not something to expose to
// anyone who merely knows the table's numeric id.
tablesRouter.get('/:id/reviews', asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT id, host_user_id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (!(await isTableMember(table, req.user.sub))) {
    return res.status(403).json({ message: 'Not a member of this table' });
  }

  const rows = await db
    .prepare(
      `SELECT r.*, u.name as reviewer_name FROM reviews r
       JOIN users u ON u.id = r.reviewer_user_id
       WHERE r.table_id = ? ORDER BY r.created_at DESC`,
    )
    .all(table.id);
  res.json({ reviews: toCamelRows(rows) });
}));

async function attendeeIdsOf(table) {
  const guests = await db.prepare('SELECT user_id FROM table_guests WHERE table_id = ?').all(table.id);
  return [table.host_user_id, ...guests.map((g) => g.user_id)];
}

// Rating another person is only possible for someone you actually shared a
// (past) table with -- mirrors how Uber/Airbnb gate ratings to a real
// interaction, rather than letting anyone rate any profile. Both endpoints
// below re-check table membership + isPast independently of the frontend.
tablesRouter.get('/:id/rateable', asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT id, host_user_id, date_time FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (!(await isTableMember(table, req.user.sub))) {
    return res.status(403).json({ message: 'Not a member of this table' });
  }
  if (table.date_time >= new Date().toISOString()) {
    return res.status(400).json({ message: "This table hasn't happened yet" });
  }

  const otherIds = (await attendeeIdsOf(table)).filter((id) => id !== req.user.sub);
  const people = await Promise.all(
    otherIds.map(async (userId) => {
      const user = await db
        .prepare('SELECT u.id, u.name, p.photo_url FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?')
        .get(userId);
      const existing = await db
        .prepare('SELECT score FROM user_ratings WHERE table_id = ? AND rater_user_id = ? AND rated_user_id = ?')
        .get(table.id, req.user.sub, userId);
      return { ...toCamel(user), myRating: existing?.score ?? null };
    }),
  );
  res.json({ people });
}));

tablesRouter.post('/:id/rate', asyncHandler(async (req, res) => {
  const missingFieldsError = requireFields(req.body, ['ratedUserId', 'score']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  const ratedUserId = Number(req.body.ratedUserId);
  const score = Number(req.body.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ message: 'score must be a whole number from 1 to 5' });
  }
  if (ratedUserId === req.user.sub) {
    return res.status(400).json({ message: "You can't rate yourself" });
  }

  const table = await db.prepare('SELECT id, host_user_id, date_time FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (table.date_time >= new Date().toISOString()) {
    return res.status(400).json({ message: "This table hasn't happened yet" });
  }

  const attendeeIds = await attendeeIdsOf(table);
  if (!attendeeIds.includes(req.user.sub) || !attendeeIds.includes(ratedUserId)) {
    return res.status(403).json({ message: 'You both need to have been part of this table' });
  }

  await db
    .prepare(
      `INSERT INTO user_ratings (table_id, rater_user_id, rated_user_id, score) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE score = VALUES(score)`,
    )
    .run(table.id, req.user.sub, ratedUserId, score);

  res.json({ ok: true });
}));

// Mounted separately at /api/seat-requests since it acts on a seat request
// by its own id, not scoped under a table.
seatRequestsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const { status } = req.body ?? {};
  if (!['confirmed', 'declined'].includes(status)) {
    return res.status(400).json({ message: "status must be 'confirmed' or 'declined'" });
  }

  const seatRequest = await db.prepare('SELECT * FROM seat_requests WHERE id = ?').get(req.params.id);
  if (!seatRequest) {
    return res.status(404).json({ message: 'Seat request not found' });
  }

  const table = await db.prepare('SELECT host_user_id, seats_total FROM dining_tables WHERE id = ?').get(seatRequest.table_id);
  if (table.host_user_id !== req.user.sub) {
    return res.status(403).json({ message: 'Only the host can review this request' });
  }

  // Confirming a seat request is what actually reserves it -- the seat count
  // sent to the restaurant when the table was booked (see
  // notifyRestaurantOfBooking in POST /) is a promise this table won't seat
  // more than seatsTotal people, so it can't be exceeded here.
  if (status === 'confirmed' && (await guestCount(seatRequest.table_id)) >= table.seats_total) {
    return res.status(409).json({ message: 'This table is already fully booked -- no seats left to reserve' });
  }

  await db.prepare('UPDATE seat_requests SET status = ?, updated_at = NOW() WHERE id = ?').run(
    status,
    seatRequest.id,
  );

  if (status === 'confirmed') {
    await db.prepare('INSERT IGNORE INTO table_guests (table_id, user_id) VALUES (?, ?)').run(
      seatRequest.table_id,
      seatRequest.user_id,
    );
  }

  await createNotification(seatRequest.user_id, status === 'confirmed' ? 'seat_request_confirmed' : 'seat_request_declined', {
    tableId: seatRequest.table_id,
    actorUserId: req.user.sub,
  });

  const updated = await db.prepare('SELECT * FROM seat_requests WHERE id = ?').get(seatRequest.id);
  res.json({ seatRequest: toCamel(updated) });
}));

tablesRouter.get('/:id/messages', asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT id, host_user_id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (!(await isTableMember(table, req.user.sub))) {
    return res.status(403).json({ message: 'Not a member of this table' });
  }

  const rows = await db
    .prepare(
      `SELECT m.*, u.name as sender_name FROM table_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.table_id = ? ORDER BY m.created_at ASC`,
    )
    .all(table.id);
  res.json({ messages: toCamelRows(rows) });
}));

tablesRouter.post('/:id/messages', asyncHandler(async (req, res) => {
  const table = await db.prepare('SELECT id, host_user_id FROM dining_tables WHERE id = ?').get(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  if (!(await isTableMember(table, req.user.sub))) {
    return res.status(403).json({ message: 'Not a member of this table' });
  }
  const missingFieldsError = requireFields(req.body, ['body']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const result = await db
    .prepare('INSERT INTO table_messages (table_id, sender_id, body) VALUES (?, ?, ?)')
    .run(table.id, req.user.sub, req.body.body);

  const created = await db
    .prepare(
      `SELECT m.*, u.name as sender_name FROM table_messages m
       JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
    )
    .get(result.lastInsertRowid);
  res.status(201).json({ message: toCamel(created) });
}));
