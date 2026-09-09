import mysql from 'mysql2/promise';
import { runMigrations } from './db/migrate.js';
import { seedRestaurants } from './db/seed/restaurants.js';
import { seedInterests } from './db/seed/interests.js';

// Applied per-query below (mysql2 has no pool-wide query timeout option).
// Without this, a connection the shared host has silently black-holed (no
// RST/FIN, just dropped packets -- keepalive pings don't detect this until
// several failed probes in) leaves the query's promise awaiting a response
// that never arrives, and the connection is never released back to the
// pool. Enough of those over time exhaust the pool and every DB-backed
// route hangs until the process is restarted.
const QUERY_TIMEOUT_MS = 15000;

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  // Fails fast if the initial handshake itself stalls (distinct from
  // QUERY_TIMEOUT_MS, which covers queries on an already-established
  // connection).
  connectTimeout: 10000,
  // Returns DATE/DATETIME/TIMESTAMP columns as plain strings instead of JS
  // Date objects, matching the string-based datetime values the route code
  // was written against (string comparisons, .localeCompare, etc.).
  dateStrings: true,
  // The shared host resets idle connections; keepalive pings prevent a
  // pooled connection from going stale and erroring (ECONNRESET) on reuse.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

// mysql2's own pool.query() releases the connection back to the pool once a
// query settles, but on a `timeout` rejection it doesn't reliably do that --
// the connection can be left checked out of the pool's accounting, or
// returned to it despite still having a stale response pending on the wire.
// Acquiring/releasing explicitly lets us destroy (not release) a connection
// that just timed out, so a bad connection is dropped and replaced instead
// of quietly poisoning the pool for the next request.
async function query(sql, params) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query({ sql, timeout: QUERY_TIMEOUT_MS }, params);
    conn.release();
    return result;
  } catch (err) {
    conn.destroy();
    throw err;
  }
}

// Thin adapter over the pool that mimics the synchronous better-sqlite3-style
// `db.prepare(sql).get/all/run(...)` API the routes were written against, but
// async under the hood. Keeps every route file's query code nearly untouched
// -- only `async`/`await` needed to be added -- while swapping the engine.
export const db = {
  prepare(sql) {
    return {
      async get(...params) {
        const rows = await query(sql, params);
        return rows[0] ?? null;
      },
      async all(...params) {
        const rows = await query(sql, params);
        return rows;
      },
      async run(...params) {
        const result = await query(sql, params);
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
