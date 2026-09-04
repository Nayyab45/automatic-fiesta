import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const emergencyContactsRouter = Router();
export const blocksRouter = Router();
export const reportsRouter = Router();

emergencyContactsRouter.use(requireAuth);
blocksRouter.use(requireAuth);
reportsRouter.use(requireAuth);

emergencyContactsRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare('SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY created_at ASC')
    .all(req.user.sub);
  res.json({ contacts: toCamelRows(rows) });
}));

emergencyContactsRouter.post('/', asyncHandler(async (req, res) => {
  const { name, relationship, phone, email, notifyOnCheckin, notifyOnNoCheckout } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['name', 'phone']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const result = await db
    .prepare(
      `INSERT INTO emergency_contacts (user_id, name, relationship, phone, email, notify_on_checkin, notify_on_no_checkout)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      req.user.sub,
      name,
      relationship ?? null,
      phone,
      email ?? null,
      notifyOnCheckin === false ? 0 : 1,
      notifyOnNoCheckout === false ? 0 : 1,
    );

  const created = await db.prepare('SELECT * FROM emergency_contacts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ contact: toCamel(created) });
}));

emergencyContactsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await db.prepare('DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
  res.json({ ok: true });
}));

blocksRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT b.blocked_user_id as user_id, b.created_at, u.name, p.photo_url FROM user_blocks b
       JOIN users u ON u.id = b.blocked_user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE b.blocker_user_id = ? ORDER BY b.created_at DESC`,
    )
    .all(req.user.sub);
  res.json({ blocked: toCamelRows(rows) });
}));

blocksRouter.post('/', asyncHandler(async (req, res) => {
  const { userId } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['userId']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  if (Number(userId) === req.user.sub) {
    return res.status(400).json({ message: "You can't block yourself" });
  }

  await db.prepare('INSERT IGNORE INTO user_blocks (blocker_user_id, blocked_user_id) VALUES (?, ?)').run(
    req.user.sub,
    userId,
  );
  // A block should end any existing friendship too -- staying "friends"
  // with someone you just blocked doesn't make sense.
  await db
    .prepare(
      `DELETE FROM friend_requests WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)`,
    )
    .run(req.user.sub, userId, userId, req.user.sub);
  res.status(201).json({ ok: true });
}));

blocksRouter.delete('/:userId', asyncHandler(async (req, res) => {
  await db.prepare('DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?').run(
    req.user.sub,
    req.params.userId,
  );
  res.json({ ok: true });
}));

reportsRouter.post('/', asyncHandler(async (req, res) => {
  const { reportedUserId, reason, details, alsoBlock } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['reportedUserId', 'reason']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  await db.prepare('INSERT INTO user_reports (reporter_user_id, reported_user_id, reason, details) VALUES (?, ?, ?, ?)').run(
    req.user.sub,
    reportedUserId,
    reason,
    details ?? null,
  );

  if (alsoBlock) {
    await db.prepare('INSERT IGNORE INTO user_blocks (blocker_user_id, blocked_user_id) VALUES (?, ?)').run(
      req.user.sub,
      reportedUserId,
    );
  }

  res.status(201).json({ ok: true });
}));
