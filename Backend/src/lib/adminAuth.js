import { db } from '../db.js';

// Not from the JWT (issued at login, so a later admin flag flip wouldn't
// show up without forcing a re-login) -- read fresh from the DB every time.
// Shared by every admin route (verification review, moderation) rather than
// each route file defining its own copy.
export async function requireAdmin(req, res, next) {
  const row = await db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.sub);
  if (!row?.is_admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}
