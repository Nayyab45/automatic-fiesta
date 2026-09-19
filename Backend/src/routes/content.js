import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAdmin } from '../lib/adminAuth.js';

export const contentRouter = Router();

// Only these pages are editable -- keeps PUT from becoming a generic
// key/value store anyone with an admin token could write arbitrary rows to.
const EDITABLE_SLUGS = new Set(['privacy-policy', 'community-guidelines']);

const MAX_SECTIONS = 40;
const MAX_TEXT = 8000;

function slugError(slug) {
  return EDITABLE_SLUGS.has(slug) ? null : 'Unknown page';
}

// { intro?: string, sections: [{ heading, body }] } -- validated and
// rebuilt field by field so only these keys are ever stored.
function cleanContent(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.sections)) {
    return { error: 'content must include a sections list' };
  }
  if (input.sections.length === 0 || input.sections.length > MAX_SECTIONS) {
    return { error: `Add between 1 and ${MAX_SECTIONS} sections` };
  }
  const sections = [];
  for (const section of input.sections) {
    const heading = typeof section?.heading === 'string' ? section.heading.trim() : '';
    const body = typeof section?.body === 'string' ? section.body.trim() : '';
    if (!heading) return { error: 'Every section needs a heading' };
    if (heading.length > 200 || body.length > MAX_TEXT) return { error: 'A section is too long' };
    sections.push({ heading, body });
  }
  const intro = typeof input.intro === 'string' ? input.intro.trim() : '';
  if (intro.length > MAX_TEXT) return { error: 'The intro is too long' };
  return { content: { intro, sections } };
}

// Public: the Privacy Policy is readable before signing up. `content` is
// null when no admin has edited the page, and the app shows its built-in text.
contentRouter.get('/:slug', asyncHandler(async (req, res) => {
  const error = slugError(req.params.slug);
  if (error) return res.status(404).json({ message: error });

  const row = await db.prepare('SELECT body, updated_at FROM site_content WHERE slug = ?').get(req.params.slug);
  if (!row) return res.json({ content: null, updatedAt: null });
  res.json({ content: JSON.parse(row.body), updatedAt: row.updated_at });
}));

contentRouter.put('/:slug', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const error = slugError(req.params.slug);
  if (error) return res.status(404).json({ message: error });

  const { content, error: contentError } = cleanContent(req.body?.content);
  if (contentError) return res.status(400).json({ message: contentError });

  await db
    .prepare(
      `INSERT INTO site_content (slug, body, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE body = VALUES(body), updated_by = VALUES(updated_by)`,
    )
    .run(req.params.slug, JSON.stringify(content), req.user.sub);
  res.json({ content });
}));

// Reset to the built-in text.
contentRouter.delete('/:slug', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const error = slugError(req.params.slug);
  if (error) return res.status(404).json({ message: error });
  await db.prepare('DELETE FROM site_content WHERE slug = ?').run(req.params.slug);
  res.json({ ok: true });
}));
