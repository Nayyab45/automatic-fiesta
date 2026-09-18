export async function up(pool) {
  // Backs the "Women-only" event audience (see 0020_table_audience.js) --
  // there's no other signal in this app that could tell a women-only table
  // who's actually eligible to join. Nullable and never required at
  // signup/onboarding: a profile with no gender on file just can't join a
  // women-only table (same "excluded, not guessed into" rule Discover
  // People's age filter already uses).
  await pool.query("ALTER TABLE user_profiles ADD COLUMN gender VARCHAR(20) NULL");
}
