import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFields } from '../lib/validate.js';

export const verificationRouter = Router();

verificationRouter.use(requireAuth);

function statusFor(userId) {
  const row = db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(userId);
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

function upsertVerification(userId, fields) {
  const existing = db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(userId);
  const merged = {
    idFrontUrl: fields.idFrontUrl !== undefined ? fields.idFrontUrl : (existing?.id_front_url ?? null),
    idBackUrl: fields.idBackUrl !== undefined ? fields.idBackUrl : (existing?.id_back_url ?? null),
    selfieUrl: fields.selfieUrl !== undefined ? fields.selfieUrl : (existing?.selfie_url ?? null),
  };

  db.prepare(
    `INSERT INTO identity_verifications (user_id, id_front_url, id_back_url, selfie_url, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET id_front_url = excluded.id_front_url, id_back_url = excluded.id_back_url,
       selfie_url = excluded.selfie_url, updated_at = datetime('now')`,
  ).run(userId, merged.idFrontUrl, merged.idBackUrl, merged.selfieUrl);
}

verificationRouter.get('/me', (req, res) => {
  res.json(statusFor(req.user.sub));
});

verificationRouter.put('/me/id', (req, res) => {
  const missingFieldsError = requireFields(req.body, ['idFrontUrl', 'idBackUrl']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  upsertVerification(req.user.sub, req.body);
  res.json(statusFor(req.user.sub));
});

verificationRouter.put('/me/selfie', (req, res) => {
  const missingFieldsError = requireFields(req.body, ['selfieUrl']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  upsertVerification(req.user.sub, req.body);
  res.json(statusFor(req.user.sub));
});

verificationRouter.post('/me/submit', (req, res) => {
  const row = db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(req.user.sub);
  if (!row?.id_front_url || !row?.id_back_url || !row?.selfie_url) {
    return res.status(400).json({ message: 'Upload your ID and a selfie before submitting' });
  }

  db.prepare(
    "UPDATE identity_verifications SET status = 'pending', submitted_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?",
  ).run(req.user.sub);
  res.json(statusFor(req.user.sub));
});
