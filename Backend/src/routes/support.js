import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamelRows } from '../lib/serialize.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAdmin } from '../lib/adminAuth.js';

export const supportRouter = Router();
supportRouter.use(requireAuth);

supportRouter.post('/', asyncHandler(async (req, res) => {
  const { subject, message } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['subject', 'message']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  await db.prepare('INSERT INTO support_messages (user_id, subject, message) VALUES (?, ?, ?)').run(
    req.user.sub,
    subject,
    message,
  );
  res.status(201).json({ ok: true });
}));

supportRouter.get('/admin', requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await db
    .prepare(
      `SELECT m.id, m.subject, m.message, m.status, m.created_at, u.name, u.email
       FROM support_messages m
       JOIN users u ON u.id = m.user_id
       ORDER BY (m.status = 'open') DESC, m.created_at ASC`,
    )
    .all();
  res.json({ messages: toCamelRows(rows) });
}));

supportRouter.post('/admin/:id/resolve', requireAdmin, asyncHandler(async (req, res) => {
  await db.prepare("UPDATE support_messages SET status = 'resolved' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
}));
