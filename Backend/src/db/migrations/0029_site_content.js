export async function up(pool) {
  // Admin-editable copy for the Privacy Policy and Community Guidelines
  // screens (see routes/content.js). A missing row means "use the built-in
  // default text shipped in the app", so deleting a row is the reset.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_content (
      slug VARCHAR(64) NOT NULL PRIMARY KEY,
      body MEDIUMTEXT NOT NULL,
      updated_by INT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}
