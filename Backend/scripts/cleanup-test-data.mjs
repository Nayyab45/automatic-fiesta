// One-off (but kept around -- see below) cleanup for rows Backend/test/api.test.js
// leaves behind in the shared remote MySQL DB. The test suite runs directly
// against DB_HOST from .env (there is no separate test database -- it was
// never repointed after the node:sqlite -> MySQL migration), so every test
// run inserts real rows there; each test's own cleanup only runs if that
// test finishes normally. A run that hits node --test's file-level timeout
// (this DB is remote and slow enough that a full run can take 5+ minutes)
// gets killed mid-suite, skipping whatever cleanup the in-flight and later
// tests would have done -- exactly what happened here, leaving ~90 rows.
//
// Identifies test users by the exact pattern the suite's own helpers use
// (see Backend/test/api.test.js's signup()): "<label>+test-<runId>@example.com",
// plus this session's own "ai-verify-*@example.com" manual test accounts.
// Both patterns are unique to generated test data -- no real account uses
// @example.com -- but this still runs a cross-contamination check before
// deleting anything: if a real (non-test) user ever ended up a guest at a
// test-hosted table, the run aborts instead of deleting that table under
// them.
//
// Usage: node scripts/cleanup-test-data.mjs [--dry-run]
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DRY_RUN = process.argv.includes('--dry-run');

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
});

async function query(sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

const testUsers = await query(
  `SELECT id, name, email FROM users
   WHERE email LIKE '%+test-%@example.com' OR email LIKE 'ai-verify-%@example.com'
   ORDER BY id`,
);
const testIds = testUsers.map((u) => u.id);

if (testIds.length === 0) {
  console.log('No test users found -- nothing to clean up.');
  await conn.end();
  process.exit(0);
}

console.log(`Found ${testIds.length} test users (ids ${testIds[0]}-${testIds[testIds.length - 1]}).`);

const idList = testIds.join(',');
const testTables = await query(`SELECT id FROM dining_tables WHERE host_user_id IN (${idList})`);
const testTableIds = testTables.map((t) => t.id);

// Safety check: a real user should never be a guest/reviewer/etc. at a
// table hosted entirely by test accounts, since test tables and their
// guests are always created together within the same test run. If this
// ever finds one, it means a real account interacted with test data
// somehow -- abort rather than delete a table out from under a real user.
if (testTableIds.length > 0) {
  const tableIdList = testTableIds.join(',');
  const crossContamination = await query(
    `SELECT 'table_guests' as src, user_id FROM table_guests WHERE table_id IN (${tableIdList}) AND user_id NOT IN (${idList})
     UNION ALL SELECT 'seat_requests', user_id FROM seat_requests WHERE table_id IN (${tableIdList}) AND user_id NOT IN (${idList})
     UNION ALL SELECT 'check_ins', user_id FROM check_ins WHERE table_id IN (${tableIdList}) AND user_id NOT IN (${idList})
     UNION ALL SELECT 'reviews', reviewer_user_id FROM reviews WHERE table_id IN (${tableIdList}) AND reviewer_user_id NOT IN (${idList})
     UNION ALL SELECT 'table_messages', sender_id FROM table_messages WHERE table_id IN (${tableIdList}) AND sender_id NOT IN (${idList})`,
  );
  if (crossContamination.length > 0) {
    console.error('ABORTING: a real (non-test) user is linked to a test-hosted table:', crossContamination);
    await conn.end();
    process.exit(1);
  }
}

console.log(`${testTableIds.length} test-hosted dining tables will also be removed.`);

if (DRY_RUN) {
  console.log('--dry-run: no changes made. Candidate users:');
  for (const u of testUsers) console.log(`  id=${u.id} name="${u.name}" email=${u.email}`);
  await conn.end();
  process.exit(0);
}

let totalDeleted = 0;
async function del(label, sql) {
  const result = await query(sql);
  const n = result.affectedRows ?? 0;
  totalDeleted += n;
  if (n > 0) console.log(`  ${label}: ${n}`);
}

// Content rows scoped to test-hosted tables (must go before dining_tables
// itself, and covers rows whose only test signal is table_id, not user_id).
if (testTableIds.length > 0) {
  const t = testTableIds.join(',');
  await del('table_guests (by table)', `DELETE FROM table_guests WHERE table_id IN (${t})`);
  await del('seat_requests (by table)', `DELETE FROM seat_requests WHERE table_id IN (${t})`);
  await del('check_ins (by table)', `DELETE FROM check_ins WHERE table_id IN (${t})`);
  await del('reviews (by table)', `DELETE FROM reviews WHERE table_id IN (${t})`);
  await del('table_messages (by table)', `DELETE FROM table_messages WHERE table_id IN (${t})`);
  await del('notifications (by table)', `DELETE FROM notifications WHERE table_id IN (${t})`);
  await del('dining_tables', `DELETE FROM dining_tables WHERE id IN (${t})`);
}

// Every other row keyed directly by a test user's id, across every table
// that references users.id anywhere in the schema (see src/db/schema/*.js) --
// deleteUserAccount() in auth.js only covers the identity-adjacent subset
// meant for a real user's self-service delete, not a full data wipe.
const i = idList;
await del('conversation_participants', `DELETE FROM conversation_participants WHERE user_id IN (${i})`);
await del('direct_messages', `DELETE FROM direct_messages WHERE sender_id IN (${i})`);
await del('notifications (by user/actor)', `DELETE FROM notifications WHERE user_id IN (${i}) OR actor_user_id IN (${i})`);
await del('subscriptions', `DELETE FROM subscriptions WHERE user_id IN (${i})`);
await del('payment_transactions', `DELETE FROM payment_transactions WHERE user_id IN (${i})`);
await del('saved_restaurants', `DELETE FROM saved_restaurants WHERE user_id IN (${i})`);
await del('user_reports', `DELETE FROM user_reports WHERE reporter_user_id IN (${i}) OR reported_user_id IN (${i})`);
await del('user_ratings', `DELETE FROM user_ratings WHERE rater_user_id IN (${i}) OR rated_user_id IN (${i})`);
await del('user_follows', `DELETE FROM user_follows WHERE follower_user_id IN (${i}) OR followed_user_id IN (${i})`);
await del('profile_views', `DELETE FROM profile_views WHERE viewer_user_id IN (${i}) OR viewed_user_id IN (${i})`);
await del('preference_updates', `DELETE FROM preference_updates WHERE user_id IN (${i})`);
await del('device_tokens', `DELETE FROM device_tokens WHERE user_id IN (${i})`);
await del('identity_verifications', `DELETE FROM identity_verifications WHERE user_id IN (${i})`);
await del('restaurant_reviews', `DELETE FROM restaurant_reviews WHERE reviewer_user_id IN (${i})`);

// Identity-adjacent rows -- same set deleteUserAccount() covers, replicated
// here as bulk IN(...) deletes (90 individual calls would be 90x the round
// trips to a remote, already-slow DB for no benefit -- see db.js's own
// comments on this host's latency).
await del('refresh_tokens', `DELETE FROM refresh_tokens WHERE user_id IN (${i})`);
await del('password_reset_tokens', `DELETE FROM password_reset_tokens WHERE user_id IN (${i})`);
await del('two_factor_auth', `DELETE FROM two_factor_auth WHERE user_id IN (${i})`);
await del('user_interests', `DELETE FROM user_interests WHERE user_id IN (${i})`);
await del('food_preferences', `DELETE FROM food_preferences WHERE user_id IN (${i})`);
await del('dietary_preferences', `DELETE FROM dietary_preferences WHERE user_id IN (${i})`);
await del('match_preferences', `DELETE FROM match_preferences WHERE user_id IN (${i})`);
await del('privacy_settings', `DELETE FROM privacy_settings WHERE user_id IN (${i})`);
await del('emergency_contacts', `DELETE FROM emergency_contacts WHERE user_id IN (${i})`);
await del('payment_methods', `DELETE FROM payment_methods WHERE user_id IN (${i})`);
await del('user_profiles', `DELETE FROM user_profiles WHERE user_id IN (${i})`);
await del('user_blocks', `DELETE FROM user_blocks WHERE blocker_user_id IN (${i}) OR blocked_user_id IN (${i})`);
await del('friend_requests', `DELETE FROM friend_requests WHERE requester_id IN (${i}) OR recipient_id IN (${i})`);

// Conversations left with zero participants after the above (a test-only
// DM thread) are just dead rows now -- clean those up too.
await del(
  'conversations (orphaned)',
  `DELETE c FROM conversations c LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id WHERE cp.conversation_id IS NULL`,
);

await del('users', `DELETE FROM users WHERE id IN (${i})`);

console.log(`Done. ${totalDeleted} rows deleted across ${testIds.length} test users.`);
await conn.end();
