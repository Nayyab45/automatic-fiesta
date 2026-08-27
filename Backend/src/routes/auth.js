import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const TOKEN_TTL = '7d';

function toPublicUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

authRouter.post('/signup', (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
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

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
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
  res.json({ user: row });
});
