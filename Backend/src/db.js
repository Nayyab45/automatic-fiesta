import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usersSchema } from './db/schema/users.js';
import { restaurantsSchema } from './db/schema/restaurants.js';
import { seedRestaurants } from './db/seed/restaurants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'app.sqlite');

export const db = new DatabaseSync(dbPath);

for (const schema of [usersSchema, restaurantsSchema]) {
  db.exec(schema);
}

for (const seed of [seedRestaurants]) {
  seed(db);
}
