import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';

export const contentRouter = Router();

// Only these pages exist -- keeps this from becoming a generic key/value
// lookup for arbitrary slugs.
const EDITABLE_SLUGS = new Set(['privacy-policy', 'community-guidelines']);

function slugError(slug) {
  return EDITABLE_SLUGS.has(slug) ? null : 'Unknown page';
}

// Public: the Privacy Policy is readable before signing up. `content` is
// always null now -- the app shows its built-in text (see
// src/app/shared/policy-content.ts's DEFAULT_* constants).
contentRouter.get('/:slug', asyncHandler(async (req, res) => {
  const error = slugError(req.params.slug);
  if (error) return res.status(404).json({ message: error });
  res.json({ content: null, updatedAt: null });
}));
