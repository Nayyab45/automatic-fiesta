export async function up(pool) {
  // Optional written review alongside the existing 1-5 star score -- shown
  // publicly on the rated person's profile (see profileRouter's /:id/reviews
  // in profile.js). Nullable: the star rating alone remains valid on its own.
  await pool.query('ALTER TABLE user_ratings ADD COLUMN comment TEXT NULL');
}
