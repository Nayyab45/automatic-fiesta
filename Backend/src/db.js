import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usersSchema } from './db/schema/users.js';
import { restaurantsSchema } from './db/schema/restaurants.js';
import { tablesSchema } from './db/schema/tables.js';
import { profilesSchema } from './db/schema/profiles.js';
import { seedRestaurants } from './db/seed/restaurants.js';
import { seedInterests } from './db/seed/interests.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'app.sqlite');

export const db = new DatabaseSync(dbPath);

for (const schema of [usersSchema, restaurantsSchema, tablesSchema, profilesSchema]) {
  db.exec(schema);
}

for (const seed of [seedRestaurants, seedInterests]) {
  seed(db);
}
