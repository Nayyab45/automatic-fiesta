import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const verificationRouter = Router();

verificationRouter.use(requireAuth);

// The one place identity_verifications.status='approved' actually becomes
// the verified badge people see elsewhere (profile.js's fullProfile/people/
// matches all read user_profiles.verified directly).
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
      submittedAt: null,
    };
  }
  return {
    status: row.status,
    hasIdFront: !!row.id_front_url,
    hasIdBack: !!row.id_back_url,
    submittedAt: row.submitted_at,
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
  };

  await db.prepare(
    `INSERT INTO identity_verifications (user_id, id_front_url, id_back_url, updated_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE id_front_url = VALUES(id_front_url), id_back_url = VALUES(id_back_url),
       updated_at = NOW()`,
  ).run(userId, merged.idFrontUrl, merged.idBackUrl);
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

verificationRouter.post('/me/submit', asyncHandler(async (req, res) => {
  const row = await db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(req.user.sub);
  if (!row?.id_front_url || !row?.id_back_url) {
    return res.status(400).json({ message: 'Upload your CNIC before submitting' });
  }

  // No face-match step and no admin review queue exist anymore -- a CNIC
  // upload is itself the whole check, so approve immediately rather than
  // leaving the submission stuck in 'pending' with nothing left to ever
  // move it out of that state.
  await db.prepare(
    "UPDATE identity_verifications SET status = 'approved', submitted_at = NOW(), updated_at = NOW() WHERE user_id = ?",
  ).run(req.user.sub);
  await setVerifiedStatus(req.user.sub, true);
  res.json(await statusForUser(req.user.sub));
}));
