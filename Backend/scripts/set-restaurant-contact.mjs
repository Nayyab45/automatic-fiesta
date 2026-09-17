// Sets a restaurant's contact_email/contact_phone (see migration
// 0016_restaurant_contact_info.js) so booking notifications
// (src/lib/restaurantNotify.js) actually have somewhere to go. There's no
// admin panel for this yet -- same situation as identity verification
// review, see verification.js -- so this is a manual one-off script like
// the rest of this directory (e.g. fix-photo-urls.mjs), not an API route.
//
// Usage:
//   node scripts/set-restaurant-contact.mjs <id-or-name> [--email a@b.com] [--phone +923001234567]
//   node scripts/set-restaurant-contact.mjs --list-missing   (restaurants with no contact info yet)
import 'dotenv/config';
import mysql from 'mysql2/promise';

const args = process.argv.slice(2);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

if (args[0] === '--list-missing') {
  const [rows] = await conn.query(
    'SELECT id, name, city FROM restaurants WHERE contact_email IS NULL AND contact_phone IS NULL ORDER BY name',
  );
  console.log(`${rows.length} restaurant(s) with no contact info:`);
  for (const row of rows) console.log(`  #${row.id}  ${row.name} (${row.city})`);
  await conn.end();
  process.exit(0);
}

const target = args[0];
const emailIndex = args.indexOf('--email');
const phoneIndex = args.indexOf('--phone');
const email = emailIndex !== -1 ? args[emailIndex + 1] : undefined;
const phone = phoneIndex !== -1 ? args[phoneIndex + 1] : undefined;

if (!target || (email === undefined && phone === undefined)) {
  console.error(
    'Usage: node scripts/set-restaurant-contact.mjs <id-or-name> [--email a@b.com] [--phone +923001234567]\n' +
      '       node scripts/set-restaurant-contact.mjs --list-missing',
  );
  await conn.end();
  process.exit(1);
}

const isId = /^\d+$/.test(target);
const [matches] = await conn.query(
  isId ? 'SELECT id, name, contact_email, contact_phone FROM restaurants WHERE id = ?'
       : 'SELECT id, name, contact_email, contact_phone FROM restaurants WHERE name LIKE ?',
  [isId ? target : `%${target}%`],
);

if (matches.length === 0) {
  console.error(`No restaurant found matching "${target}".`);
  await conn.end();
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`"${target}" matches more than one restaurant -- use the numeric id instead:`);
  for (const row of matches) console.error(`  #${row.id}  ${row.name}`);
  await conn.end();
  process.exit(1);
}

const restaurant = matches[0];
const updates = [];
const values = [];
if (email !== undefined) {
  updates.push('contact_email = ?');
  values.push(email);
}
if (phone !== undefined) {
  updates.push('contact_phone = ?');
  values.push(phone);
}

await conn.query(`UPDATE restaurants SET ${updates.join(', ')} WHERE id = ?`, [...values, restaurant.id]);
console.log(`Updated #${restaurant.id} ${restaurant.name}:`);
if (email !== undefined) console.log(`  contact_email: ${restaurant.contact_email ?? '(none)'} -> ${email}`);
if (phone !== undefined) console.log(`  contact_phone: ${restaurant.contact_phone ?? '(none)'} -> ${phone}`);

await conn.end();
