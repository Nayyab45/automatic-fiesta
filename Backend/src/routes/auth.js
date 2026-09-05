import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import QRCode from 'qrcode';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel } from '../lib/serialize.js';
import { requireFields, passwordStrengthError } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { mailer } from '../lib/mailer.js';

export const authRouter = Router();

// Short-lived access token (used on every request) plus a long-lived,
// revocable refresh token (used only to mint new access tokens). A stolen
// access token is only useful for 15 minutes; a stolen refresh token can be
// revoked server-side via refresh_tokens, which a bare JWT never could be.
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;
const RESET_TOKEN_TTL_MINUTES = 60;
// How long a "password was correct, now enter your 2FA code" challenge
// stays valid for -- short, since it only needs to survive the user
// switching to their authenticator app and back.
const TWO_FACTOR_CHALLENGE_TTL_MINUTES = 5;

function toPublicUser(row) {
  const { id, name, email } = toCamel(row);
  return { id, name, email };
}

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function issueRefreshToken(userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
    userId,
    hashToken(token),
    expiresAt,
  );
  return token;
}

async function issueSession(user) {
  return { accessToken: signAccessToken(user), refreshToken: await issueRefreshToken(user.id), user };
}

function signTwoFactorChallenge(userId) {
  return jwt.sign({ sub: userId, purpose: '2fa-challenge' }, process.env.JWT_SECRET, {
    expiresIn: `${TWO_FACTOR_CHALLENGE_TTL_MINUTES}m`,
  });
}

// Throws (via jwt.verify) on an expired/tampered/wrong-purpose token --
// callers are expected to catch and respond 401, same as any other invalid
// credential.
function verifyTwoFactorChallenge(challengeToken) {
  const decoded = jwt.verify(challengeToken, process.env.JWT_SECRET);
  if (decoded.purpose !== '2fa-challenge') {
    throw new Error('Not a 2FA challenge token');
  }
  return decoded.sub;
}

authRouter.post('/signup', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body ?? {};

  const missingFieldsError = requireFields(req.body, ['name', 'email', 'password']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  const passwordError = passwordStrengthError(password);
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ message: 'An account with that email already exists' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(String(name).trim(), normalizedEmail, passwordHash);

  const user = toPublicUser({ id: result.lastInsertRowid, name: name.trim(), email: normalizedEmail });
  res.status(201).json(await issueSession(user));
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};

  const missingFieldsError = requireFields(req.body, ['email', 'password']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const row = await db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const twoFactor = await db.prepare('SELECT enabled FROM two_factor_auth WHERE user_id = ?').get(row.id);
  if (twoFactor?.enabled) {
    // Correct password, but the session isn't issued yet -- the client
    // exchanges this challenge token + a TOTP code for the real session via
    // /auth/2fa/verify-login. Never issue real tokens before that check.
    return res.json({ twoFactorRequired: true, challengeToken: signTwoFactorChallenge(row.id) });
  }

  res.json(await issueSession(toPublicUser(row)));
}));

// Rotates the refresh token on every use: the presented one is revoked and a
// fresh one issued alongside the new access token. A refresh token can only
// ever be redeemed once, so a copied-but-unused token becomes worthless the
// next time the legitimate client refreshes.
authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['refreshToken']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const row = await db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashToken(refreshToken));
  if (!row || row.revoked_at || row.expires_at < new Date().toISOString()) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }

  await db.prepare('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?').run(row.id);

  const user = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(row.user_id);
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }

  res.json(await issueSession(toPublicUser(user)));
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    await db.prepare('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?').run(hashToken(refreshToken));
  }
  res.json({ ok: true });
}));

// No email provider is configured yet, so the reset link can't actually be
// emailed -- it's logged server-side instead so the flow is genuinely
// testable end to end. Swap the console.log below for a real provider
// (SendGrid/SES/etc.) before this goes anywhere near real users; never
// return the token in the response itself, and never reveal whether the
// email matched an account (the response is identical either way).
authRouter.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['email']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);

  if (user) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
    await db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
      user.id,
      hashToken(token),
      expiresAt,
    );

    const resetUrl = `${process.env.PUBLIC_APP_URL || 'http://localhost:8100'}/reset-password-new?token=${token}`;
    if (mailer.isConfigured()) {
      try {
        await mailer.sendPasswordResetEmail({ to: normalizedEmail, resetUrl });
      } catch (err) {
        // Still respond ok:true below -- an email-delivery hiccup shouldn't
        // reveal to the caller whether the address matched an account, and
        // the token is still valid via the logged fallback if support needs
        // to hand it to the user manually.
        console.error('[password reset] failed to send email:', err);
        console.log(`[password reset] ${normalizedEmail} -> ${resetUrl}`);
      }
    } else {
      // No RESEND_API_KEY/RESEND_FROM_EMAIL configured -- log the link so
      // it's still usable in dev instead of silently going nowhere.
      console.log(`[password reset] ${normalizedEmail} -> ${resetUrl}`);
    }
  }

  res.json({ ok: true });
}));

authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['token', 'password']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  const passwordError = passwordStrengthError(password);
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }

  const row = await db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').get(hashToken(token));
  if (!row || row.used_at || row.expires_at < new Date().toISOString()) {
    return res.status(401).json({ message: 'Invalid or expired reset link' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, row.user_id);
  await db.prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?').run(row.id);
  // A password reset is a strong signal the account may have been
  // compromised -- revoke every existing session rather than leaving old
  // refresh tokens (possibly the attacker's) valid.
  await db.prepare('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL').run(row.user_id);

  res.json({ ok: true });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const row = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.sub);
  if (!row) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ user: toPublicUser(row) });
}));

authRouter.put('/me', requireAuth, asyncHandler(async (req, res) => {
  const { name, email } = req.body ?? {};
  const current = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.sub);

  if (email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, req.user.sub);
    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }
  }

  await db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(
    name?.trim() || current.name,
    email ? String(email).trim().toLowerCase() : current.email,
    req.user.sub,
  );

  const updated = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.sub);
  res.json({ user: toPublicUser(updated) });
}));

// Deletes the user-identity-adjacent rows a person would expect gone (profile,
// preferences, interests, emergency contacts) plus the login itself. Content
// they created that other people's data now points to (hosted tables,
// reviews, messages) is left in place rather than cascading a delete across
// the whole relational graph -- the same trade-off a lot of small apps make
// before building a real soft-delete/anonymization path.
authRouter.delete('/me', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  await db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM two_factor_auth WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM food_preferences WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM dietary_preferences WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM match_preferences WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM privacy_settings WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM emergency_contacts WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM payment_methods WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM user_blocks WHERE blocker_user_id = ? OR blocked_user_id = ?').run(userId, userId);
  await db.prepare('DELETE FROM friend_requests WHERE requester_id = ? OR recipient_id = ?').run(userId, userId);
  await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ ok: true });
}));

authRouter.get('/2fa/status', requireAuth, asyncHandler(async (req, res) => {
  const row = await db.prepare('SELECT enabled FROM two_factor_auth WHERE user_id = ?').get(req.user.sub);
  res.json({ enabled: !!row?.enabled });
}));

// Generates a fresh secret and stores it as not-yet-enabled -- re-running
// setup (e.g. the user backed out and started over) just overwrites the
// pending secret rather than accumulating rows, since enabled stays 0 until
// /enable actually verifies a code against it.
authRouter.post('/2fa/setup', requireAuth, asyncHandler(async (req, res) => {
  const user = await db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.sub);
  const secret = generateSecret();

  await db.prepare(
    `INSERT INTO two_factor_auth (user_id, secret, enabled) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE secret = VALUES(secret), enabled = 0`,
  ).run(req.user.sub, secret);

  const otpauthUrl = generateURI({ strategy: 'totp', issuer: 'What Should We Eat', label: user.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  res.json({ secret, qrCodeDataUrl });
}));

authRouter.post('/2fa/enable', requireAuth, asyncHandler(async (req, res) => {
  const { code } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['code']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const row = await db.prepare('SELECT secret FROM two_factor_auth WHERE user_id = ?').get(req.user.sub);
  if (!row || !(await verifyTotp({ token: String(code), secret: row.secret })).valid) {
    return res.status(401).json({ message: 'Incorrect code. Check your authenticator app and try again.' });
  }

  await db.prepare('UPDATE two_factor_auth SET enabled = 1 WHERE user_id = ?').run(req.user.sub);
  res.json({ ok: true });
}));

// Requires a current code rather than just a password -- disabling 2FA is
// exactly the action an attacker who already stole the password (but not
// the authenticator) would want to take.
authRouter.post('/2fa/disable', requireAuth, asyncHandler(async (req, res) => {
  const { code } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['code']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  const row = await db.prepare('SELECT secret, enabled FROM two_factor_auth WHERE user_id = ?').get(req.user.sub);
  if (!row?.enabled || !(await verifyTotp({ token: String(code), secret: row.secret })).valid) {
    return res.status(401).json({ message: 'Incorrect code.' });
  }

  await db.prepare('DELETE FROM two_factor_auth WHERE user_id = ?').run(req.user.sub);
  res.json({ ok: true });
}));

authRouter.post('/2fa/verify-login', asyncHandler(async (req, res) => {
  const { challengeToken, code } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['challengeToken', 'code']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }

  let userId;
  try {
    userId = verifyTwoFactorChallenge(challengeToken);
  } catch {
    return res.status(401).json({ message: 'This login attempt has expired. Please log in again.' });
  }

  const twoFactor = await db.prepare('SELECT secret FROM two_factor_auth WHERE user_id = ? AND enabled = 1').get(userId);
  const user = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
  if (!twoFactor || !user || !(await verifyTotp({ token: String(code), secret: twoFactor.secret })).valid) {
    return res.status(401).json({ message: 'Incorrect code.' });
  }

  res.json(await issueSession(toPublicUser(user)));
}));
