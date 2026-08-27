import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usersSchema } from './db/schema/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'app.sqlite');

export const db = new DatabaseSync(dbPath);

for (const schema of [usersSchema]) {
  db.exec(schema);
}
