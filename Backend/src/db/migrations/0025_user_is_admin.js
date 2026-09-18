export async function up(pool) {
  // No roles/permissions system elsewhere in this app -- a single boolean
  // is enough for the one thing an admin can currently do (review identity
  // verification submissions stuck at 'pending' with no other resolution
  // path -- see verificationRouter's admin routes in verification.js).
  await pool.query('ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0');
}
