// The pre-migration-tool baseline: every table this app had before
// schema_migrations existed. Kept as one migration rather than split up
// retroactively, since splitting it wouldn't be meaningful history -- these
// all landed together over many earlier commits. New schema changes from
// here on get their own numbered migration file instead of editing these
// schema modules directly.
import { usersSchema } from '../schema/users.js';
import { restaurantsSchema } from '../schema/restaurants.js';
import { tablesSchema } from '../schema/tables.js';
import { profilesSchema } from '../schema/profiles.js';
import { messagingSchema } from '../schema/messaging.js';
import { safetySchema } from '../schema/safety.js';
import { settingsSchema } from '../schema/settings.js';
import { verificationSchema } from '../schema/verification.js';
import { paymentsSchema } from '../schema/payments.js';

export async function up(pool, { runSql }) {
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
    await runSql(pool, schema);
  }
}
