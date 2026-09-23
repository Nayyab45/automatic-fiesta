export async function up(pool) {
  // Admin functionality (role, moderation queue, suspensions, flagging) has
  // been removed from the app entirely -- see the deleted admin blocks in
  // routes/*.js and the deleted lib/adminAuth.js. Reverses
  // 0025_user_is_admin.js, 0026_user_flagged.js, 0028_user_suspension.js.
  await pool.query('ALTER TABLE users DROP COLUMN is_admin');
  await pool.query('ALTER TABLE users DROP COLUMN flagged_at');
  await pool.query('ALTER TABLE users DROP COLUMN suspended_at');
  await pool.query('ALTER TABLE users DROP COLUMN suspended_reason');

  // The in-app support-message inbox (and its admin view) is gone --
  // reverses 0027_support_messages.js.
  await pool.query('DROP TABLE IF EXISTS support_messages');

  // Privacy Policy / Community Guidelines are no longer admin-editable;
  // routes/content.js and routes/site.js now always serve the built-in
  // default text -- reverses 0029_site_content.js.
  await pool.query('DROP TABLE IF EXISTS site_content');
}
