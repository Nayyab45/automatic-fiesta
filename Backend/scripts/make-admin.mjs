// Grants admin access (is_admin=1) to one user by email -- the only way in,
// since there's no admin-management UI (deliberately not built; this is a
// single-operator app). Run with `node scripts/make-admin.mjs someone@example.com`.
import 'dotenv/config';
import mysql from 'mysql2/promise';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/make-admin.mjs <email>');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

const [result] = await pool.query('UPDATE users SET is_admin = 1 WHERE email = ?', [email]);
if (result.affectedRows === 0) {
  console.error(`No user found with email ${email}`);
} else {
  console.log(`${email} is now an admin.`);
}
await pool.end();
