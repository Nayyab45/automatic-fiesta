import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFields } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const verificationRouter = Router();

verificationRouter.use(requireAuth);

function statusFor(row) {
  if (!row) {
    return { status: 'not_started', hasIdFront: false, hasIdBack: false, hasSelfie: false, submittedAt: null };
  }
  return {
    status: row.status,
    hasIdFront: !!row.id_front_url,
    hasIdBack: !!row.id_back_url,
    hasSelfie: !!row.selfie_url,
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

  await db.prepare(
    "UPDATE identity_verifications SET status = 'pending', submitted_at = NOW(), updated_at = NOW() WHERE user_id = ?",
  ).run(req.user.sub);
  res.json(await statusForUser(req.user.sub));
}));
