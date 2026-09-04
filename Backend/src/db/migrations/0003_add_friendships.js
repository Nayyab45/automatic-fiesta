export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      requester_id INT NOT NULL,
      recipient_id INT NOT NULL,
      -- Declining just deletes the row (see friends.js) so a fresh request
      -- can be sent later -- only 'pending'/'accepted' ever get stored.
      status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_pair (requester_id, recipient_id)
    )
  `);
}
