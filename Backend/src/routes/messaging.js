import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const conversationsRouter = Router();
export const notificationsRouter = Router();

conversationsRouter.use(requireAuth);
notificationsRouter.use(requireAuth);

// Inserted from other route files (e.g. seat-request lifecycle) so notification
// wording stays centralized in formatNotification() below instead of being
// re-derived at every call site.
export async function createNotification(userId, type, { tableId = null, actorUserId = null } = {}) {
  await db.prepare('INSERT INTO notifications (user_id, type, table_id, actor_user_id) VALUES (?, ?, ?, ?)').run(
    userId,
    type,
    tableId,
    actorUserId,
  );
}

async function otherParticipant(conversationId, userId) {
  const row = await db
    .prepare(
      `SELECT u.id, u.name, p.photo_url FROM conversation_participants cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE cp.conversation_id = ? AND cp.user_id != ?`,
    )
    .get(conversationId, userId);
  return row ? toCamel(row) : null;
}

async function isParticipant(conversationId, userId) {
  return !!(await db
    .prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
    .get(conversationId, userId));
}

conversationsRouter.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const conversations = await db
    .prepare(
      `SELECT c.id, c.created_at, cp.last_read_at FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?`,
    )
    .all(userId);

  const result = await Promise.all(
    conversations.map(async (conversation) => {
      const person = await otherParticipant(conversation.id, userId);
      const lastMessage = await db
        .prepare('SELECT body, sender_id, created_at FROM direct_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(conversation.id);
      const { count: unreadCount } = await db
        .prepare(
          `SELECT COUNT(*) as count FROM direct_messages
           WHERE conversation_id = ? AND sender_id != ? AND (? IS NULL OR created_at > ?)`,
        )
        .get(conversation.id, userId, conversation.last_read_at, conversation.last_read_at);

      return {
        id: conversation.id,
        person,
        lastMessage: lastMessage ? toCamel(lastMessage) : null,
        unreadCount,
      };
    }),
  );

  result.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? '';
    const bTime = b.lastMessage?.createdAt ?? '';
    return bTime.localeCompare(aTime);
  });

  res.json({ conversations: result });
}));

conversationsRouter.post('/', asyncHandler(async (req, res) => {
  const { recipientId } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['recipientId']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  if (Number(recipientId) === req.user.sub) {
    return res.status(400).json({ message: "You can't message yourself" });
  }

  const recipient = await db.prepare('SELECT id FROM users WHERE id = ?').get(recipientId);
  if (!recipient) {
    return res.status(404).json({ message: 'User not found' });
  }

  const existing = await db
    .prepare(
      `SELECT cp1.conversation_id as id FROM conversation_participants cp1
       JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id AND cp2.user_id = ?
       WHERE cp1.user_id = ?`,
    )
    .get(recipientId, req.user.sub);

  let conversationId = existing?.id;
  if (!conversationId) {
    const result = await db.prepare('INSERT INTO conversations () VALUES ()').run();
    conversationId = result.lastInsertRowid;
    const addParticipant = db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)');
    await addParticipant.run(conversationId, req.user.sub);
    await addParticipant.run(conversationId, recipientId);
  }

  res.status(201).json({ conversation: { id: conversationId, person: await otherParticipant(conversationId, req.user.sub) } });
}));

conversationsRouter.get('/:id', asyncHandler(async (req, res) => {
  if (!(await isParticipant(req.params.id, req.user.sub))) {
    return res.status(403).json({ message: 'Not a participant in this conversation' });
  }
  res.json({ conversation: { id: Number(req.params.id), person: await otherParticipant(req.params.id, req.user.sub) } });
}));

conversationsRouter.get('/:id/messages', asyncHandler(async (req, res) => {
  if (!(await isParticipant(req.params.id, req.user.sub))) {
    return res.status(403).json({ message: 'Not a participant in this conversation' });
  }
  const rows = await db
    .prepare(
      `SELECT m.*, u.name as sender_name FROM direct_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? ORDER BY m.created_at ASC`,
    )
    .all(req.params.id);
  res.json({ messages: toCamelRows(rows) });
}));

conversationsRouter.post('/:id/messages', asyncHandler(async (req, res) => {
  if (!(await isParticipant(req.params.id, req.user.sub))) {
    return res.status(403).json({ message: 'Not a participant in this conversation' });
  }
  const missingFieldsError = requireFields(req.body, ['body']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const result = await db
    .prepare('INSERT INTO direct_messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
    .run(req.params.id, req.user.sub, req.body.body);
  await db.prepare(
    `INSERT INTO conversation_participants (conversation_id, user_id, last_read_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE last_read_at = NOW()`,
  ).run(req.params.id, req.user.sub);

  const created = await db
    .prepare(
      `SELECT m.*, u.name as sender_name FROM direct_messages m
       JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
    )
    .get(result.lastInsertRowid);
  res.status(201).json({ message: toCamel(created) });
}));

conversationsRouter.post('/:id/read', asyncHandler(async (req, res) => {
  await db.prepare(
    `INSERT INTO conversation_participants (conversation_id, user_id, last_read_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE last_read_at = NOW()`,
  ).run(req.params.id, req.user.sub);
  res.json({ ok: true });
}));

function formatNotification(row) {
  const actorName = row.actor_name ?? 'Someone';
  const restaurantName = row.restaurant_name ?? 'the restaurant';
  const messages = {
    seat_request_received: `${actorName} requested a seat at ${restaurantName}`,
    seat_request_confirmed: `Your seat request was approved at ${restaurantName}`,
    seat_request_declined: `Your seat request was declined at ${restaurantName}`,
  };

  return {
    id: row.id,
    type: row.type,
    message: messages[row.type] ?? 'You have a new notification',
    tableId: row.table_id,
    actorName: row.actor_user_id ? actorName : null,
    read: !!row.read_at,
    createdAt: row.created_at,
  };
}

notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT n.*, actor.name as actor_name, r.name as restaurant_name FROM notifications n
       LEFT JOIN users actor ON actor.id = n.actor_user_id
       LEFT JOIN dining_tables t ON t.id = n.table_id
       LEFT JOIN restaurants r ON r.id = t.restaurant_id
       WHERE n.user_id = ? ORDER BY n.created_at DESC`,
    )
    .all(req.user.sub);
  res.json({ notifications: rows.map(formatNotification) });
}));

notificationsRouter.post('/read-all', asyncHandler(async (req, res) => {
  await db.prepare('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL').run(req.user.sub);
  res.json({ ok: true });
}));
