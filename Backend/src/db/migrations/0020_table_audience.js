export async function up(pool) {
  // Restricts who can see/join a *public* table beyond the existing
  // public/private visibility split -- 'everyone' (today's behavior),
  // 'women_only' (checked against user_profiles.gender, see
  // 0019_profile_gender.js) or 'friends_only' (checked against the existing
  // friendships table). Meaningless for a private table, which is already
  // invite-only regardless of audience, so it's just left at the default
  // there rather than modeled as a separate nullable state.
  await pool.query(
    "ALTER TABLE dining_tables ADD COLUMN audience VARCHAR(20) NOT NULL DEFAULT 'everyone'",
  );
}
