import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { faceMatch } from '../lib/faceMatch.js';

export const verificationRouter = Router();

verificationRouter.use(requireAuth);

// Not from the JWT (issued at login, so a later admin flag flip wouldn't
// show up without forcing a re-login) -- read fresh from the DB every time.
async function requireAdmin(req, res, next) {
  const row = await db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.sub);
  if (!row?.is_admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

// The one place identity_verifications.status='approved' actually becomes
// the verified badge people see elsewhere (profile.js's fullProfile/people/
// matches all read user_profiles.verified directly) -- neither the
// automated Face++ path below nor a human reviewer's decision did this
// before, so an "approved" submission never actually turned the badge on.
async function setVerifiedStatus(userId, approved) {
  await db.prepare(
    `INSERT INTO user_profiles (user_id, verified, updated_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE verified = VALUES(verified), updated_at = NOW()`,
  ).run(userId, approved ? 1 : 0);
}

function statusFor(row) {
  if (!row) {
    return {
      status: 'not_started',
      hasIdFront: false,
      hasIdBack: false,
      hasSelfie: false,
      submittedAt: null,
      faceMatchConfidence: null,
    };
  }
  return {
    status: row.status,
    hasIdFront: !!row.id_front_url,
    hasIdBack: !!row.id_back_url,
    hasSelfie: !!row.selfie_url,
    submittedAt: row.submitted_at,
    faceMatchConfidence: row.face_match_confidence,
  };
}

async function statusForUser(userId) {
  const row = await db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(userId);
  return statusFor(row);
}

async function upsertVerification(userId, fields) {
  const existing = await db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(userId);
  const merged = {
    idFrontUrl: fields.idFrontUrl !== undefined ? fields.idFrontUrl : (existing?.id_front_url ?? null),
    idBackUrl: fields.idBackUrl !== undefined ? fields.idBackUrl : (existing?.id_back_url ?? null),
    selfieUrl: fields.selfieUrl !== undefined ? fields.selfieUrl : (existing?.selfie_url ?? null),
  };

  await db.prepare(
    `INSERT INTO identity_verifications (user_id, id_front_url, id_back_url, selfie_url, updated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE id_front_url = VALUES(id_front_url), id_back_url = VALUES(id_back_url),
       selfie_url = VALUES(selfie_url), updated_at = NOW()`,
  ).run(userId, merged.idFrontUrl, merged.idBackUrl, merged.selfieUrl);
}

verificationRouter.get('/me', asyncHandler(async (req, res) => {
  res.json(await statusForUser(req.user.sub));
}));

verificationRouter.put('/me/id', asyncHandler(async (req, res) => {
  const missingFieldsError = requireFields(req.body, ['idFrontUrl', 'idBackUrl']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  await upsertVerification(req.user.sub, req.body);
  res.json(await statusForUser(req.user.sub));
}));

verificationRouter.put('/me/selfie', asyncHandler(async (req, res) => {
  const missingFieldsError = requireFields(req.body, ['selfieUrl']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  await upsertVerification(req.user.sub, req.body);
  res.json(await statusForUser(req.user.sub));
}));

verificationRouter.post('/me/submit', asyncHandler(async (req, res) => {
  const row = await db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(req.user.sub);
  if (!row?.id_front_url || !row?.id_back_url || !row?.selfie_url) {
    return res.status(400).json({ message: 'Upload your ID and a selfie before submitting' });
  }

  // Without this, there's no other mechanism anywhere in this app that
  // ever moves a submission out of 'pending' -- there's no admin/reviewer
  // endpoint, so a manual-review-only submission would sit pending forever.
  // When Face++ is configured, decide immediately from the match; when
  // it isn't (or it couldn't reach a verdict -- no face detected, bad
  // lighting, a transient API error), fall back to the original
  // indefinite-'pending' behavior rather than guessing.
  const match = faceMatch.isConfigured() ? await faceMatch.compareFaces(row.id_front_url, row.selfie_url) : null;
  const status = match ? (match.isMatch ? 'approved' : 'rejected') : 'pending';

  await db.prepare(
    'UPDATE identity_verifications SET status = ?, face_match_confidence = ?, submitted_at = NOW(), updated_at = NOW() WHERE user_id = ?',
  ).run(status, match?.confidence ?? null, req.user.sub);
  if (status === 'approved') await setVerifiedStatus(req.user.sub, true);
  res.json(await statusForUser(req.user.sub));
}));

// Admin-only: submissions Face++ couldn't resolve on its own (not
// configured, no face detected, a transient API error) -- the only
// remaining 'pending' cases, since a real verdict already auto-resolves
// above.
verificationRouter.get('/admin/pending', requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await db
    .prepare(
      `SELECT u.id as user_id, u.name, u.email, v.id_front_url, v.id_back_url, v.selfie_url, v.submitted_at
       FROM identity_verifications v
       JOIN users u ON u.id = v.user_id
       WHERE v.status = 'pending'
       ORDER BY v.submitted_at ASC`,
    )
    .all();
  res.json({
    submissions: rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      email: r.email,
      idFrontUrl: r.id_front_url,
      idBackUrl: r.id_back_url,
      selfieUrl: r.selfie_url,
      submittedAt: r.submitted_at,
    })),
  });
}));

verificationRouter.patch('/admin/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.body ?? {};
  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ message: "status must be 'approved' or 'rejected'" });
  }

  const row = await db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(req.params.userId);
  if (!row) {
    return res.status(404).json({ message: 'No submission for this user' });
  }

  await db.prepare('UPDATE identity_verifications SET status = ?, updated_at = NOW() WHERE user_id = ?').run(status, req.params.userId);
  await setVerifiedStatus(req.params.userId, status === 'approved');
  res.json(await statusForUser(req.params.userId));
}));
