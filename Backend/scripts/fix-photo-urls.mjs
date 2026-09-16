import 'dotenv/config';
import mysql from 'mysql2/promise';

// LAN-IP drift keeps stranding old hosts in stored photo_url values (see
// PUBLIC_ASSET_BASE_URL's comment in .env) -- list every host this project
// has used so a rerun after a future IP change stays a one-liner add here.
const OLD_HOSTS = ['http://192.168.43.136:3000', 'http://10.43.209.160:3000'];
const NEW_HOST = process.env.PUBLIC_ASSET_BASE_URL;
const TABLES = ['restaurants', 'dishes', 'cuisine_stock_photos'];

if (!NEW_HOST) {
  console.error('PUBLIC_ASSET_BASE_URL is not set -- refusing to rewrite photo_url to nothing.');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

for (const table of TABLES) {
  for (const oldHost of OLD_HOSTS) {
    if (oldHost === NEW_HOST) continue;
    const [result] = await conn.query(
      `UPDATE ${table} SET photo_url = REPLACE(photo_url, ?, ?) WHERE photo_url LIKE ?`,
      [oldHost, NEW_HOST, `${oldHost}%`],
    );
    if (result.affectedRows) console.log(`${table}: ${result.affectedRows} rows updated (${oldHost} -> ${NEW_HOST})`);
  }
}

await conn.end();
