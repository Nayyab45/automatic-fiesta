import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFields, isNonEmptyString } from '../lib/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const waitlistRouter = Router();

waitlistRouter.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

waitlistRouter.post('/', asyncHandler(async (req, res) => {
  const { email } = req.body ?? {};
  const missingFieldsError = requireFields(req.body, ['email']);
  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  if (!isNonEmptyString(email) || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ message: 'Enter a valid email address' });
  }

  await db
    .prepare('INSERT IGNORE INTO feature_waitlist (user_id, email) VALUES (?, ?)')
    .run(req.user.sub, email.trim());

  res.status(201).json({ ok: true });
}));
