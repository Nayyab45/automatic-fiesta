export async function up(pool) {
  // Set by an admin (see authRouter's /admin/users/:id/suspend in auth.js) to
  // block sign-in without the irreversible step of deleting the account --
  // distinct from flagged_at (an automated signal that just queues someone
  // for review) and from a moderation delete (permanent). suspended_reason
  // is shown back to the user on their blocked login attempt.
  await pool.query('ALTER TABLE users ADD COLUMN suspended_at DATETIME NULL');
  await pool.query('ALTER TABLE users ADD COLUMN suspended_reason VARCHAR(255) NULL');
}
