export async function up(pool) {
  // Replaces the old "Help & Support" page's bare mailto: link (nothing
  // backed it -- support@whatshouldweeat.com was never a real inbox) with
  // an actual submission an admin can see and act on.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
