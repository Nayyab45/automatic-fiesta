import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Splits a schema block's raw multi-statement SQL into individual
// statements -- mysql2 doesn't run multiple statements per query by
// default, and enabling that flag is a wider footgun (it also enables
// stacked-query SQL injection if any input ever reaches a raw query
// string) than just splitting here. Strips `--` line comments first since
// a schema file's own prose can otherwise contain a semicolon and silently
// break a naive split into two garbage statements.
export async function runSql(pool, sql) {
  const withoutComments = sql
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

// Applies every migration in ./migrations that hasn't run against this
// database yet, in filename order (hence the zero-padded numeric prefixes),
// and records each one in schema_migrations so it's never re-applied. Each
// migration file exports `up(pool, { runSql })`. Safe to call on every
// server start, same as the old initSchema() was -- most existing
// migrations are themselves idempotent (CREATE TABLE IF NOT EXISTS), and
// schema_migrations means even a non-idempotent one only ever runs once.
export async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [appliedRows] = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(appliedRows.map((row) => row.name));

  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.js')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    // Dynamic import() requires a file:// URL, not a raw path -- a plain
    // Windows path like "D:\..." isn't a valid ESM specifier and throws
    // ERR_UNSUPPORTED_ESM_URL_SCHEME.
    const { up } = await import(pathToFileURL(path.join(MIGRATIONS_DIR, file)));
    console.log(`[migrate] applying ${file}`);
    await up(pool, { runSql });
    await pool.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
  }
}
