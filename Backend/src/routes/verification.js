import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { faceMatch } from '../lib/faceMatch.js';

export const verificationRouter = Router();

verificationRouter.use(requireAuth);

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
