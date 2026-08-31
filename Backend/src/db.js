import mysql from 'mysql2/promise';
import { usersSchema } from './db/schema/users.js';
import { restaurantsSchema } from './db/schema/restaurants.js';
import { tablesSchema } from './db/schema/tables.js';
import { profilesSchema } from './db/schema/profiles.js';
import { messagingSchema } from './db/schema/messaging.js';
import { safetySchema } from './db/schema/safety.js';
import { settingsSchema } from './db/schema/settings.js';
import { verificationSchema } from './db/schema/verification.js';
import { paymentsSchema } from './db/schema/payments.js';
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

async function execSchema(schema) {
  // Strip `--` line comments before splitting on `;` -- a schema file's own
  // prose can otherwise contain a semicolon (as an example: this sentence
  // does) and silently break a naive split into two garbage statements.
  const withoutComments = schema
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
  const statements = withoutComments
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await pool.query(statement);
  }
}

export async function initSchema() {
  for (const schema of [
    usersSchema,
    restaurantsSchema,
    tablesSchema,
    profilesSchema,
    messagingSchema,
    safetySchema,
    settingsSchema,
    verificationSchema,
    paymentsSchema,
  ]) {
    await execSchema(schema);
  }

  await seedRestaurants(db);
  await seedInterests(db);
}
