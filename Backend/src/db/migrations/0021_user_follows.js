export async function up(pool) {
  // Deliberately separate from friend_requests: following is one-way and
  // needs no acceptance, unlike a friendship which is always mutual. Someone
  // can follow another user whether or not they're also friends.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_follows (
      follower_user_id INT NOT NULL,
      followed_user_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_user_id, followed_user_id)
    )
  `);
}
