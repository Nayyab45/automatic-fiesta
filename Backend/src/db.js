import mysql from 'mysql2/promise';
import { runMigrations } from './db/migrate.js';
import { seedRestaurants } from './db/seed/restaurants.js';
import { seedInterests } from './db/seed/interests.js';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  // Returns DATE/DATETIME/TIMESTAMP columns as plain strings instead of JS
  // Date objects, matching the string-based datetime values the route code
  // was written against (string comparisons, .localeCompare, etc.).
  dateStrings: true,
  // The shared host resets idle connections; keepalive pings prevent a
  // pooled connection from going stale and erroring (ECONNRESET) on reuse.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

// Thin adapter over the pool that mimics the synchronous better-sqlite3-style
// `db.prepare(sql).get/all/run(...)` API the routes were written against, but
// async under the hood. Keeps every route file's query code nearly untouched
// -- only `async`/`await` needed to be added -- while swapping the engine.
export const db = {
  prepare(sql) {
    return {
      async get(...params) {
        const [rows] = await pool.query(sql, params);
        return rows[0] ?? null;
      },
      async all(...params) {
        const [rows] = await pool.query(sql, params);
        return rows;
      },
      async run(...params) {
        const [result] = await pool.query(sql, params);
        return { lastInsertRowid: result.insertId, changes: result.affectedRows };
      },
    };
  },
};

export async function initSchema() {
  await runMigrations(pool);
  await seedRestaurants(db);
  await seedInterests(db);
}
