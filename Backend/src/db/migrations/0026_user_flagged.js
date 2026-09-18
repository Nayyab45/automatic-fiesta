export async function up(pool) {
  // Set once a user is blocked by BLOCK_FLAG_THRESHOLD distinct people (see
  // blocksRouter.post in safety.js) -- surfaces them in the admin
  // moderation queue for a human decision (dismiss vs. permanently delete)
  // rather than auto-banning on a signal that requires no reason at all and
  // is trivially exploitable by a coordinated group.
  await pool.query('ALTER TABLE users ADD COLUMN flagged_at DATETIME NULL');
}
