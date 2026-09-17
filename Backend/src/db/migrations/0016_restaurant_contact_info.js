export async function up(pool) {
  // Lets a booking notification (see src/lib/restaurantNotify.js) actually
  // reach the restaurant. Nullable since existing seeded restaurants have no
  // contact info and there's no admin UI yet to add it -- notifying just
  // no-ops for a restaurant with neither column set.
  await pool.query('ALTER TABLE restaurants ADD COLUMN contact_email VARCHAR(255) NULL');
  await pool.query('ALTER TABLE restaurants ADD COLUMN contact_phone VARCHAR(32) NULL');
}
