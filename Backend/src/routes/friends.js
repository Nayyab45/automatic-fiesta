import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamelRows } from '../lib/serialize.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createNotification } from './messaging.js';

export const friendsRouter = Router();
export const followsRouter = Router();
friendsRouter.use(requireAuth);
followsRouter.use(requireAuth);

// A friend_requests row is directionless once accepted, and there's never
// more than one row per pair either way (the unique key covers both
// orderings via findPair's OR) -- so every lookup here checks both
// (requester, recipient) orderings rather than assuming which side sent it.
async function findPair(userId, otherId) {
  return db
    .prepare(
      `SELECT * FROM friend_requests
       WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)`,
    )
    .get(userId, otherId, otherId, userId);
}

friendsRouter.get('/status/:userId', asyncHandler(async (req, res) => {
  const otherId = Number(req.params.userId);
  const row = await findPair(req.user.sub, otherId);
  if (!row) return res.json({ status: 'none' });
  if (row.status === 'accepted') return res.json({ status: 'friends', requestId: row.id });
  res.json({
    status: row.requester_id === req.user.sub ? 'pending_sent' : 'pending_received',
    requestId: row.id,
  });
}));

// Shared with restaurants.js's /group-recommendation, which needs to check
// that every member it's about to read taste/dietary data for is actually a
// friend of the requester -- the same privacy boundary this router already
// enforces on its own list/status endpoints.
export async function friendIdsOf(userId) {
  const rows = await db
    .prepare(
      `SELECT (CASE WHEN requester_id = ? THEN recipient_id ELSE requester_id END) as friend_id
       FROM friend_requests WHERE status = 'accepted' AND (requester_id = ? OR recipient_id = ?)`,
    )
    .all(userId, userId, userId);
  return rows.map((r) => r.friend_id);
}

friendsRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT u.id, u.name, p.photo_url, p.city FROM friend_requests f
       JOIN users u ON u.id = (CASE WHEN f.requester_id = ? THEN f.recipient_id ELSE f.requester_id END)
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.recipient_id = ?)
       ORDER BY f.updated_at DESC`,
    )
    .all(req.user.sub, req.user.sub, req.user.sub);
  res.json({ friends: toCamelRows(rows) });
}));

friendsRouter.get('/requests', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT f.id, f.created_at, u.id as requester_id, u.name, p.photo_url FROM friend_requests f
       JOIN users u ON u.id = f.requester_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE f.recipient_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
    )
    .all(req.user.sub);
  res.json({ requests: toCamelRows(rows) });
}));

// Shared by the up-front check and the race-recovery path below: given a
// pair row that already exists for (myId, otherId), respond the same way
// regardless of which path found it -- a request seen a moment earlier
// isn't handled any differently than one that showed up because this
// request lost a race to create it.
async function respondToExistingPair(res, pair, myId, otherId) {
  if (pair.status === 'accepted') {
    return res.json({ status: 'friends', requestId: pair.id });
  }
  if (pair.requester_id === otherId) {
    // They already sent us a request -- accept it instead of creating a
    // second row (the unique key on the pair wouldn't allow that anyway).
    await db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(pair.id);
    await createNotification(otherId, 'friend_request_accepted', { actorUserId: myId });
    return res.json({ status: 'friends', requestId: pair.id });
  }
  return res.json({ status: 'pending_sent', requestId: pair.id });
}

friendsRouter.post('/requests', asyncHandler(async (req, res) => {
  const { recipientId } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['recipientId']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  const otherId = Number(recipientId);
  if (otherId === req.user.sub) {
    return res.status(400).json({ message: "You can't friend yourself" });
  }

  const blocked = await db
    .prepare(
      `SELECT 1 FROM user_blocks
       WHERE (blocker_user_id = ? AND blocked_user_id = ?) OR (blocker_user_id = ? AND blocked_user_id = ?)`,
    )
    .get(req.user.sub, otherId, otherId, req.user.sub);
  if (blocked) {
    return res.status(403).json({ message: 'Cannot send a friend request to this user' });
  }

  const existing = await findPair(req.user.sub, otherId);
  if (existing) {
    return respondToExistingPair(res, existing, req.user.sub, otherId);
  }

  let result;
  try {
    result = await db
      .prepare('INSERT INTO friend_requests (requester_id, recipient_id) VALUES (?, ?)')
      .run(req.user.sub, otherId);
  } catch (err) {
    // Two near-simultaneous requests for the same pair can both pass the
    // "no existing row" check above before either INSERT commits -- the
    // loser hits the table's unique pair constraint. That's a lost race,
    // not a real failure, so resolve it the same way a request that
    // arrived a moment later than the winner's would have been resolved,
    // instead of 500ing.
    if (err.code === 'ER_DUP_ENTRY') {
      const race = await findPair(req.user.sub, otherId);
      return respondToExistingPair(res, race, req.user.sub, otherId);
    }
    throw err;
  }

  await createNotification(otherId, 'friend_request_received', { actorUserId: req.user.sub });
  res.status(201).json({ status: 'pending_sent', requestId: result.lastInsertRowid });
}));

friendsRouter.post('/requests/:id/accept', asyncHandler(async (req, res) => {
  const request = await db
    .prepare("SELECT * FROM friend_requests WHERE id = ? AND recipient_id = ? AND status = 'pending'")
    .get(req.params.id, req.user.sub);
  if (!request) {
    return res.status(404).json({ message: 'Friend request not found' });
  }
  await db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(request.id);
  await createNotification(request.requester_id, 'friend_request_accepted', { actorUserId: req.user.sub });
  res.json({ status: 'friends' });
}));

// Also reachable by the original requester -- lets "Request Sent" on the
// sender's side act as a cancel button, not just something the recipient
// can act on.
friendsRouter.post('/requests/:id/decline', asyncHandler(async (req, res) => {
  await db
    .prepare('DELETE FROM friend_requests WHERE id = ? AND (recipient_id = ? OR requester_id = ?)')
    .run(req.params.id, req.user.sub, req.user.sub);
  res.json({ ok: true });
}));

friendsRouter.delete('/:userId', asyncHandler(async (req, res) => {
  await db
    .prepare(
      `DELETE FROM friend_requests WHERE status = 'accepted'
       AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))`,
    )
    .run(req.user.sub, req.params.userId, req.params.userId, req.user.sub);
  res.json({ ok: true });
}));

// Following is one-way and needs no acceptance, unlike the mutual
// friend_requests flow above -- see 0021_user_follows.js.
followsRouter.get('/status/:userId', asyncHandler(async (req, res) => {
  const following = await db
    .prepare('SELECT 1 FROM user_follows WHERE follower_user_id = ? AND followed_user_id = ?')
    .get(req.user.sub, req.params.userId);
  res.json({ following: !!following });
}));

followsRouter.post('/:userId', asyncHandler(async (req, res) => {
  const followedId = Number(req.params.userId);
  if (followedId === req.user.sub) {
    return res.status(400).json({ message: "You can't follow yourself" });
  }

  const blocked = await db
    .prepare(
      `SELECT 1 FROM user_blocks
       WHERE (blocker_user_id = ? AND blocked_user_id = ?) OR (blocker_user_id = ? AND blocked_user_id = ?)`,
    )
    .get(req.user.sub, followedId, followedId, req.user.sub);
  if (blocked) {
    return res.status(403).json({ message: 'Cannot follow this user' });
  }

  await db
    .prepare('INSERT IGNORE INTO user_follows (follower_user_id, followed_user_id) VALUES (?, ?)')
    .run(req.user.sub, followedId);
  res.status(201).json({ following: true });
}));

followsRouter.delete('/:userId', asyncHandler(async (req, res) => {
  await db
    .prepare('DELETE FROM user_follows WHERE follower_user_id = ? AND followed_user_id = ?')
    .run(req.user.sub, req.params.userId);
  res.json({ following: false });
}));

// Excluded from both lists: anyone in either direction of a block, so a block
// really removes them from the people you manage here -- the same rule
// people/matches already apply (see NOT_BLOCKED_CLAUSE in profile.js).
const NOT_BLOCKED_USER = `u.id NOT IN (
  SELECT blocked_user_id FROM user_blocks WHERE blocker_user_id = ?
  UNION
  SELECT blocker_user_id FROM user_blocks WHERE blocked_user_id = ?
)`;

followsRouter.get('/followers', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT u.id, u.name, p.photo_url, p.city FROM user_follows f
       JOIN users u ON u.id = f.follower_user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE f.followed_user_id = ? AND ${NOT_BLOCKED_USER}
       ORDER BY f.created_at DESC`,
    )
    .all(req.user.sub, req.user.sub, req.user.sub);
  res.json({ followers: toCamelRows(rows) });
}));

// Remove someone who follows me -- they stop following, and can follow again
// (following needs no approval). Registered as its own path so it can't be
// confused with DELETE /:userId above, which is *me* unfollowing them.
followsRouter.delete('/followers/:userId', asyncHandler(async (req, res) => {
  await db
    .prepare('DELETE FROM user_follows WHERE follower_user_id = ? AND followed_user_id = ?')
    .run(req.params.userId, req.user.sub);
  res.json({ removed: true });
}));

followsRouter.get('/following', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT u.id, u.name, p.photo_url, p.city FROM user_follows f
       JOIN users u ON u.id = f.followed_user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE f.follower_user_id = ? AND ${NOT_BLOCKED_USER}
       ORDER BY f.created_at DESC`,
    )
    .all(req.user.sub, req.user.sub, req.user.sub);
  res.json({ following: toCamelRows(rows) });
}));
