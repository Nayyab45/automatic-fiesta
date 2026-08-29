import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel } from '../lib/serialize.js';
import { requireFields } from '../lib/validate.js';

export const authRouter = Router();

const TOKEN_TTL = '7d';

function toPublicUser(row) {
  const { id, name, email } = toCamel(row);
  return { id, name, email };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

authRouter.post('/signup', (req, res) => {
  const { name, email, password } = req.body ?? {};

  const missingFieldsError = requireFields(req.body, ['name', 'email', 'password']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ message: 'An account with that email already exists' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(String(name).trim(), normalizedEmail, passwordHash);

  const user = toPublicUser({ id: result.lastInsertRowid, name: name.trim(), email: normalizedEmail });
  res.status(201).json({ token: signToken(user), user });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};

  const missingFieldsError = requireFields(req.body, ['email', 'password']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const user = toPublicUser(row);
  res.json({ token: signToken(user), user });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.sub);
  if (!row) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ user: toPublicUser(row) });
});

authRouter.put('/me', requireAuth, (req, res) => {
  const { name, email } = req.body ?? {};
  const current = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.sub);

  if (email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, req.user.sub);
    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }
  }

  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(
    name?.trim() || current.name,
    email ? String(email).trim().toLowerCase() : current.email,
    req.user.sub,
  );

  const updated = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.sub);
  const user = toPublicUser(updated);
  res.json({ token: signToken(user), user });
});

// Deletes the user-identity-adjacent rows a person would expect gone (profile,
// preferences, interests, emergency contacts) plus the login itself. Content
// they created that other people's data now points to (hosted tables,
// reviews, messages) is left in place rather than cascading a delete across
// the whole relational graph -- the same trade-off a lot of small apps make
// before building a real soft-delete/anonymization path.
authRouter.delete('/me', requireAuth, (req, res) => {
  const userId = req.user.sub;
  db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM food_preferences WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM dietary_preferences WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM match_preferences WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM privacy_settings WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM emergency_contacts WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_blocks WHERE blocker_user_id = ? OR blocked_user_id = ?').run(userId, userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ ok: true });
});
