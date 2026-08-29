import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usersSchema } from './db/schema/users.js';
import { restaurantsSchema } from './db/schema/restaurants.js';
import { tablesSchema } from './db/schema/tables.js';
import { profilesSchema } from './db/schema/profiles.js';
import { messagingSchema } from './db/schema/messaging.js';
import { safetySchema } from './db/schema/safety.js';
import { settingsSchema } from './db/schema/settings.js';
import { verificationSchema } from './db/schema/verification.js';
import { paymentsSchema } from './db/schema/payments.js';
import { ensureColumn } from './lib/ensureColumn.js';
import { seedRestaurants } from './db/seed/restaurants.js';
import { seedInterests } from './db/seed/interests.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Tests set DB_PATH=:memory: so each test file gets its own throwaway
// database instead of touching the real dev database in data/app.sqlite.
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.sqlite');

export const db = new DatabaseSync(dbPath);

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
  db.exec(schema);
}

// user_profiles predates the "phone" field manage-account needs; added via
// ensureColumn rather than a migration framework since this is the only
// additive column the schema has needed so far.
ensureColumn(db, 'user_profiles', 'phone', 'TEXT');

for (const seed of [seedRestaurants, seedInterests]) {
  seed(db);
}
