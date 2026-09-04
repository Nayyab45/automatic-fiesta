import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamelRows } from '../lib/serialize.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createNotification } from './messaging.js';

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

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
  if (existing?.status === 'accepted') {
    return res.json({ status: 'friends', requestId: existing.id });
  }
  if (existing && existing.requester_id === otherId) {
    // They already sent us a request -- accept it instead of creating a
    // second row (the unique key on the pair wouldn't allow that anyway).
    await db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(existing.id);
    await createNotification(otherId, 'friend_request_accepted', { actorUserId: req.user.sub });
    return res.json({ status: 'friends', requestId: existing.id });
  }
  if (existing) {
    return res.json({ status: 'pending_sent', requestId: existing.id });
  }

  const result = await db
    .prepare('INSERT INTO friend_requests (requester_id, recipient_id) VALUES (?, ?)')
    .run(req.user.sub, otherId);
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
