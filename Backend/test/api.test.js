import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { generate as generateTotp } from 'otplib';

// db.js now talks to a live, shared MySQL/MariaDB database (see .env) instead
// of an in-memory SQLite file, and the credentials there only grant access to
// that one database (`SHOW GRANTS` confirms no CREATE DATABASE privilege) --
// so there's no way to point tests at an isolated database of their own.
// Instead this suite isolates itself within the shared database:
//   1. initSchema() is called explicitly below, since server.js only calls it
//      when run directly (`node src/server.js`), not when `app` is imported.
//      It's safe to call repeatedly -- every table is CREATE TABLE IF NOT
//      EXISTS, and the seed helpers no-op once their table has any rows.
//   2. Every user this run creates has RUN_TAG baked into its email's local
//      part, so a rerun (or a run racing another one) never collides with a
//      previous run's leftover data or a real account.
//   3. `after` deletes every row this run created (tracked via
//      createdUserIds/table ownership) directly through the DB pool, then
//      closes the pool so `node --test` can exit.
process.env.JWT_SECRET = 'test-secret';

const { app } = await import('../src/server.js');
const { initSchema, pool, db } = await import('../src/db.js');
const { importCityRestaurants } = await import('../src/lib/osmPlaces.js');

let server;
let baseUrl;

const RUN_TAG = `test-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const createdUserIds = [];

function testEmail(local) {
  return `${local}+${RUN_TAG}@example.com`;
}

// Tables keyed directly by a user id (column name may differ per table).
// Swept for every id in createdUserIds during cleanup.
const USER_ID_TABLES = [
  ['refresh_tokens', 'user_id'],
  ['user_interests', 'user_id'],
  ['food_preferences', 'user_id'],
  ['dietary_preferences', 'user_id'],
  ['match_preferences', 'user_id'],
  ['privacy_settings', 'user_id'],
  ['identity_verifications', 'user_id'],
  ['emergency_contacts', 'user_id'],
  ['payment_methods', 'user_id'],
  ['user_profiles', 'user_id'],
  ['seat_requests', 'user_id'],
  ['table_guests', 'user_id'],
  ['reviews', 'reviewer_user_id'],
  ['table_messages', 'sender_id'],
  ['direct_messages', 'sender_id'],
  ['conversation_participants', 'user_id'],
  ['user_reports', 'reporter_user_id'],
  ['user_reports', 'reported_user_id'],
  ['two_factor_auth', 'user_id'],
  ['friend_requests', 'requester_id'],
  ['friend_requests', 'recipient_id'],
];

async function cleanupTestData() {
  if (createdUserIds.length === 0) return;

  // dining_tables has no FK/cascade to depend on, so anything keyed off a
  // table this run's users hosted has to be deleted before the table itself.
  const [tableRows] = await pool.query('SELECT id FROM dining_tables WHERE host_user_id IN (?)', [createdUserIds]);
  const tableIds = tableRows.map((row) => row.id);
  if (tableIds.length > 0) {
    for (const table of ['table_guests', 'seat_requests', 'check_ins', 'reviews', 'table_messages', 'notifications']) {
      await pool.query(`DELETE FROM ${table} WHERE table_id IN (?)`, [tableIds]);
    }
    await pool.query('DELETE FROM dining_tables WHERE id IN (?)', [tableIds]);
  }

  await pool.query('DELETE FROM notifications WHERE user_id IN (?) OR actor_user_id IN (?)', [createdUserIds, createdUserIds]);
  await pool.query('DELETE FROM user_blocks WHERE blocker_user_id IN (?) OR blocked_user_id IN (?)', [createdUserIds, createdUserIds]);

  for (const [table, column] of USER_ID_TABLES) {
    await pool.query(`DELETE FROM ${table} WHERE ${column} IN (?)`, [createdUserIds]);
  }

  await pool.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
}

before(async () => {
  await initSchema();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await cleanupTestData();
  await pool.end();
});

async function api(method, path, { body, token } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function signup(local) {
  const { body } = await api('POST', '/api/auth/signup', {
    body: { name: 'Test User', email: testEmail(local), password: 'password123!' },
  });
  if (body?.user?.id) createdUserIds.push(body.user.id);
  return body; // { accessToken, refreshToken, user }
}

describe('auth', () => {
  test('signup issues a session and rejects a duplicate email', async () => {
    const session = await signup('alice');
    assert.ok(session.accessToken);
    assert.ok(session.refreshToken);
    assert.equal(session.user.email, testEmail('alice'));

    const dup = await api('POST', '/api/auth/signup', {
      body: { name: 'Alice Two', email: testEmail('alice'), password: 'password123!' },
    });
    assert.equal(dup.status, 409);
  });

  test('login rejects a wrong password', async () => {
    await signup('bob');
    const res = await api('POST', '/api/auth/login', { body: { email: testEmail('bob'), password: 'wrong-pass' } });
    assert.equal(res.status, 401);
  });

  test('a garbage access token is rejected by protected routes', async () => {
    const res = await api('GET', '/api/auth/me', { token: 'not-a-real-token' });
    assert.equal(res.status, 401);
  });

  test('refresh rotates the token pair and the used refresh token stops working', async () => {
    const session = await signup('carol');

    const refreshed = await api('POST', '/api/auth/refresh', { body: { refreshToken: session.refreshToken } });
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.accessToken);
    assert.notEqual(refreshed.body.refreshToken, session.refreshToken);

    const reuse = await api('POST', '/api/auth/refresh', { body: { refreshToken: session.refreshToken } });
    assert.equal(reuse.status, 401);
  });

  test('logout revokes the refresh token', async () => {
    const session = await signup('dave');

    const out = await api('POST', '/api/auth/logout', { body: { refreshToken: session.refreshToken } });
    assert.equal(out.status, 200);

    const tryRefresh = await api('POST', '/api/auth/refresh', { body: { refreshToken: session.refreshToken } });
    assert.equal(tryRefresh.status, 401);
  });
});

describe('blocking', () => {
  test('blocking a user removes them from /people for both people', async () => {
    const alice = await signup('block-alice');
    const bob = await signup('block-bob');
    await api('PUT', '/api/profile/me', { token: alice.accessToken, body: { city: 'Karachi' } });
    await api('PUT', '/api/profile/me', { token: bob.accessToken, body: { city: 'Karachi' } });

    const beforeBlock = await api('GET', '/api/people', { token: alice.accessToken });
    assert.ok(beforeBlock.body.people.some((p) => p.id === bob.user.id));

    const block = await api('POST', '/api/blocks', { token: alice.accessToken, body: { userId: bob.user.id } });
    assert.equal(block.status, 201);

    const afterBlock = await api('GET', '/api/people', { token: alice.accessToken });
    assert.ok(!afterBlock.body.people.some((p) => p.id === bob.user.id));

    const bobsView = await api('GET', '/api/people', { token: bob.accessToken });
    assert.ok(!bobsView.body.people.some((p) => p.id === alice.user.id));
  });
});

describe('seat requests & notifications', () => {
  test('requesting then confirming a seat notifies the host, then the guest', async () => {
    const host = await signup('host');
    const guest = await signup('guest');

    const restaurants = await api('GET', '/api/restaurants', { token: host.accessToken });
    const restaurantId = restaurants.body.restaurants[0].id;

    const table = await api('POST', '/api/tables', {
      token: host.accessToken,
      body: {
        restaurantId,
        gatheringType: 'dinner',
        dateTime: new Date(Date.now() + 86400000).toISOString(),
        seatsTotal: 4,
      },
    });
    assert.equal(table.status, 201);

    const seatReq = await api('POST', `/api/tables/${table.body.table.id}/seat-requests`, {
      token: guest.accessToken,
      body: { message: 'Count me in!' },
    });
    assert.equal(seatReq.status, 201);

    const hostNotifs = await api('GET', '/api/notifications', { token: host.accessToken });
    assert.ok(hostNotifs.body.notifications.some((n) => n.type === 'seat_request_received'));

    const confirm = await api('PATCH', `/api/seat-requests/${seatReq.body.seatRequest.id}`, {
      token: host.accessToken,
      body: { status: 'confirmed' },
    });
    assert.equal(confirm.status, 200);

    const guestNotifs = await api('GET', '/api/notifications', { token: guest.accessToken });
    assert.ok(guestNotifs.body.notifications.some((n) => n.type === 'seat_request_confirmed'));
  });

  test('a guest cannot request a seat at their own table', async () => {
    const host = await signup('self-host');
    const restaurants = await api('GET', '/api/restaurants', { token: host.accessToken });
    const restaurantId = restaurants.body.restaurants[0].id;

    const table = await api('POST', '/api/tables', {
      token: host.accessToken,
      body: {
        restaurantId,
        gatheringType: 'dinner',
        dateTime: new Date(Date.now() + 86400000).toISOString(),
        seatsTotal: 4,
      },
    });

    const res = await api('POST', `/api/tables/${table.body.table.id}/seat-requests`, {
      token: host.accessToken,
      body: {},
    });
    assert.equal(res.status, 400);
  });
});

describe('payment methods', () => {
  test('rejects a submitted number longer than last4 (i.e. refuses a full card/account number)', async () => {
    const user = await signup('payer-reject');
    const res = await api('POST', '/api/payment-methods', {
      token: user.accessToken,
      body: { type: 'visa', last4: '4242424242424242', expiryMonth: 8, expiryYear: 2027, cardholderName: 'Test User' },
    });
    assert.equal(res.status, 400);
  });

  test('adding the first method makes it default; adding a second does not', async () => {
    const user = await signup('payer-default');

    const visa = await api('POST', '/api/payment-methods', {
      token: user.accessToken,
      body: { type: 'visa', last4: '4242', expiryMonth: 8, expiryYear: 2027, cardholderName: 'Test User' },
    });
    assert.equal(visa.status, 201);
    assert.equal(visa.body.paymentMethod.isDefault, true);
    assert.equal(visa.body.paymentMethod.label, 'Visa •••• 4242');

    const easypaisa = await api('POST', '/api/payment-methods', {
      token: user.accessToken,
      body: { type: 'easypaisa', walletPhone: '03001234567' },
    });
    assert.equal(easypaisa.status, 201);
    assert.equal(easypaisa.body.paymentMethod.isDefault, false);
    assert.match(easypaisa.body.paymentMethod.label, /^EasyPaisa .*4567$/);
  });

  test('setting a new default flips off the old one; removing the default promotes another', async () => {
    const user = await signup('payer-switch');
    const first = await api('POST', '/api/payment-methods', {
      token: user.accessToken,
      body: { type: 'bank', bankName: 'Meezan Bank', accountTitle: 'Test User', last4: '1234' },
    });
    const second = await api('POST', '/api/payment-methods', {
      token: user.accessToken,
      body: { type: 'jazzcash', walletPhone: '03111234567' },
    });

    const switched = await api('PUT', `/api/payment-methods/${second.body.paymentMethod.id}/default`, { token: user.accessToken });
    assert.equal(switched.status, 200);
    const byId = Object.fromEntries(switched.body.paymentMethods.map((m) => [m.id, m]));
    assert.equal(byId[first.body.paymentMethod.id].isDefault, false);
    assert.equal(byId[second.body.paymentMethod.id].isDefault, true);

    const afterRemove = await api('DELETE', `/api/payment-methods/${second.body.paymentMethod.id}`, { token: user.accessToken });
    assert.equal(afterRemove.status, 200);
    assert.equal(afterRemove.body.paymentMethods.length, 1);
    assert.equal(afterRemove.body.paymentMethods[0].isDefault, true);
  });

  test("a user cannot see or delete another user's payment methods", async () => {
    const owner = await signup('payer-owner');
    const intruder = await signup('payer-intruder');

    const created = await api('POST', '/api/payment-methods', {
      token: owner.accessToken,
      body: { type: 'visa', last4: '9999', expiryMonth: 1, expiryYear: 2030, cardholderName: 'Owner' },
    });

    const intrudersList = await api('GET', '/api/payment-methods', { token: intruder.accessToken });
    assert.equal(intrudersList.body.paymentMethods.length, 0);

    const intruderDelete = await api('DELETE', `/api/payment-methods/${created.body.paymentMethod.id}`, {
      token: intruder.accessToken,
    });
    assert.equal(intruderDelete.status, 404);
  });
});

describe('friends', () => {
  test('send -> accept moves both sides to friends, and notifies the requester', async () => {
    const alice = await signup('friend-alice');
    const bob = await signup('friend-bob');

    const send = await api('POST', '/api/friends/requests', { token: alice.accessToken, body: { recipientId: bob.user.id } });
    assert.equal(send.status, 201);
    assert.equal(send.body.status, 'pending_sent');

    const aliceStatus = await api('GET', `/api/friends/status/${bob.user.id}`, { token: alice.accessToken });
    assert.equal(aliceStatus.body.status, 'pending_sent');
    const bobStatus = await api('GET', `/api/friends/status/${alice.user.id}`, { token: bob.accessToken });
    assert.equal(bobStatus.body.status, 'pending_received');

    const bobRequests = await api('GET', '/api/friends/requests', { token: bob.accessToken });
    assert.ok(bobRequests.body.requests.some((r) => r.requesterId === alice.user.id));

    const accept = await api('POST', `/api/friends/requests/${send.body.requestId}/accept`, { token: bob.accessToken });
    assert.equal(accept.status, 200);
    assert.equal(accept.body.status, 'friends');

    const aliceFriends = await api('GET', '/api/friends', { token: alice.accessToken });
    assert.ok(aliceFriends.body.friends.some((f) => f.id === bob.user.id));
    const bobFriends = await api('GET', '/api/friends', { token: bob.accessToken });
    assert.ok(bobFriends.body.friends.some((f) => f.id === alice.user.id));

    const aliceNotifs = await api('GET', '/api/notifications', { token: alice.accessToken });
    assert.ok(aliceNotifs.body.notifications.some((n) => n.type === 'friend_request_accepted'));
  });

  test('a mutual request (both sides send) auto-accepts instead of erroring', async () => {
    const carol = await signup('friend-carol');
    const dave = await signup('friend-dave');

    await api('POST', '/api/friends/requests', { token: carol.accessToken, body: { recipientId: dave.user.id } });
    const daveSends = await api('POST', '/api/friends/requests', { token: dave.accessToken, body: { recipientId: carol.user.id } });
    assert.equal(daveSends.status, 200);
    assert.equal(daveSends.body.status, 'friends');
  });

  test('unfriending removes the pair for both sides', async () => {
    const erin = await signup('friend-erin');
    const frank = await signup('friend-frank');

    const send = await api('POST', '/api/friends/requests', { token: erin.accessToken, body: { recipientId: frank.user.id } });
    await api('POST', `/api/friends/requests/${send.body.requestId}/accept`, { token: frank.accessToken });

    const unfriend = await api('DELETE', `/api/friends/${frank.user.id}`, { token: erin.accessToken });
    assert.equal(unfriend.status, 200);

    const erinStatus = await api('GET', `/api/friends/status/${frank.user.id}`, { token: erin.accessToken });
    assert.equal(erinStatus.body.status, 'none');
  });

  test('blocking a friend ends the friendship', async () => {
    const gina = await signup('friend-gina');
    const hank = await signup('friend-hank');

    const send = await api('POST', '/api/friends/requests', { token: gina.accessToken, body: { recipientId: hank.user.id } });
    await api('POST', `/api/friends/requests/${send.body.requestId}/accept`, { token: hank.accessToken });

    await api('POST', '/api/blocks', { token: gina.accessToken, body: { userId: hank.user.id } });

    const status = await api('GET', `/api/friends/status/${hank.user.id}`, { token: gina.accessToken });
    assert.equal(status.body.status, 'none');
  });

  test("can't send a friend request to yourself", async () => {
    const ivan = await signup('friend-ivan');
    const res = await api('POST', '/api/friends/requests', { token: ivan.accessToken, body: { recipientId: ivan.user.id } });
    assert.equal(res.status, 400);
  });
});

describe('two-factor auth', () => {
  test('status is disabled until setup + enable, and enable rejects a wrong code', async () => {
    const user = await signup('2fa-status');

    const before2fa = await api('GET', '/api/auth/2fa/status', { token: user.accessToken });
    assert.equal(before2fa.body.enabled, false);

    const setup = await api('POST', '/api/auth/2fa/setup', { token: user.accessToken });
    assert.ok(setup.body.secret);
    assert.match(setup.body.qrCodeDataUrl, /^data:image\/png;base64,/);

    const wrongCode = await api('POST', '/api/auth/2fa/enable', { token: user.accessToken, body: { code: '000000' } });
    assert.equal(wrongCode.status, 401);

    const stillDisabled = await api('GET', '/api/auth/2fa/status', { token: user.accessToken });
    assert.equal(stillDisabled.body.enabled, false);

    const code = await generateTotp({ secret: setup.body.secret });
    const enabled = await api('POST', '/api/auth/2fa/enable', { token: user.accessToken, body: { code } });
    assert.equal(enabled.status, 200);

    const afterEnable = await api('GET', '/api/auth/2fa/status', { token: user.accessToken });
    assert.equal(afterEnable.body.enabled, true);
  });

  test('login is gated behind a TOTP code once 2FA is enabled, then disable turns it back off', async () => {
    const email = testEmail('2fa-login');
    const password = 'password123!';
    const signupRes = await api('POST', '/api/auth/signup', { body: { name: '2FA Login', email, password } });
    createdUserIds.push(signupRes.body.user.id);

    const setup = await api('POST', '/api/auth/2fa/setup', { token: signupRes.body.accessToken });
    await api('POST', '/api/auth/2fa/enable', {
      token: signupRes.body.accessToken,
      body: { code: await generateTotp({ secret: setup.body.secret }) },
    });

    // Password alone no longer issues a session -- it hands back a
    // short-lived challenge instead.
    const loginAttempt = await api('POST', '/api/auth/login', { body: { email, password } });
    assert.equal(loginAttempt.status, 200);
    assert.equal(loginAttempt.body.twoFactorRequired, true);
    assert.ok(loginAttempt.body.challengeToken);
    assert.equal(loginAttempt.body.accessToken, undefined);

    const wrongCodeLogin = await api('POST', '/api/auth/2fa/verify-login', {
      body: { challengeToken: loginAttempt.body.challengeToken, code: '000000' },
    });
    assert.equal(wrongCodeLogin.status, 401);

    const verified = await api('POST', '/api/auth/2fa/verify-login', {
      body: { challengeToken: loginAttempt.body.challengeToken, code: await generateTotp({ secret: setup.body.secret }) },
    });
    assert.equal(verified.status, 200);
    assert.ok(verified.body.accessToken);

    // Disabling requires a current code, not just the access token.
    const disableWrongCode = await api('POST', '/api/auth/2fa/disable', { token: verified.body.accessToken, body: { code: '000000' } });
    assert.equal(disableWrongCode.status, 401);

    const disabled = await api('POST', '/api/auth/2fa/disable', {
      token: verified.body.accessToken,
      body: { code: await generateTotp({ secret: setup.body.secret }) },
    });
    assert.equal(disabled.status, 200);

    // With 2FA off again, a plain login issues a session directly.
    const plainLogin = await api('POST', '/api/auth/login', { body: { email, password } });
    assert.ok(plainLogin.body.accessToken);
    assert.equal(plainLogin.body.twoFactorRequired, undefined);
  });
});

// No live network in this suite -- fetchBoundingBox/fetchPlaces are stubbed
// throughout, consistent with this project's existing avoidance of hitting
// real third-party services (payment gateways, Resend) from automated tests.
describe('real restaurant imports (OpenStreetMap)', () => {
  const testCity = `Test City ${RUN_TAG}`;

  after(async () => {
    await pool.query('DELETE FROM restaurants WHERE city = ?', [testCity]);
    await pool.query('DELETE FROM restaurant_import_log WHERE city = ?', [testCity]);
  });

  test('imports OSM results with a queryable external_id, tagged as real', async () => {
    const bbox = { south: 30, north: 31, west: 70, east: 71, region: 'Test Region' };
    const places = [
      {
        type: 'node',
        id: 111,
        lat: 30.5,
        lon: 70.5,
        tags: { name: 'Real Place One', cuisine: 'pakistani;bbq' },
      },
      {
        type: 'node',
        id: 222,
        lat: 30.6,
        lon: 70.6,
        tags: { name: 'Real Place Two' },
      },
    ];

    const result = await importCityRestaurants(db, testCity, {
      fetchBoundingBox: async () => bbox,
      fetchPlaces: async () => places,
    });
    assert.equal(result.imported, 2);

    const [rows] = await pool.query('SELECT * FROM restaurants WHERE city = ? ORDER BY name', [testCity]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].source, 'osm');
    assert.equal(rows[0].external_id, 'osm:node/111');
    assert.equal(rows[0].cuisine_tags, 'Pakistani,Bbq');
    assert.equal(rows[0].rating, null);
    // Untagged cuisine still gets an honest, non-blank label instead of ''.
    assert.equal(rows[1].cuisine_tags, 'Restaurant');
  });

  test('a second import for the same city is a no-op', async () => {
    let boundingBoxCalls = 0;
    const result = await importCityRestaurants(db, testCity, {
      fetchBoundingBox: async () => {
        boundingBoxCalls++;
        return { south: 0, north: 0, west: 0, east: 0, region: 'x' };
      },
      fetchPlaces: async () => [],
    });
    assert.equal(result.skipped, true);
    assert.equal(boundingBoxCalls, 0);
  });

  test('GET /restaurants?city=X respects the import gate and returns that city\'s rows', async () => {
    const gatedCity = `Gated City ${RUN_TAG}`;
    await pool.query(
      `INSERT INTO restaurants (name, city, region, cuisine_tags, source, external_id)
       VALUES ('Pre-seeded Real Place', ?, 'Test Region', 'Restaurant', 'osm', ?)`,
      [gatedCity, `osm:node/${RUN_TAG}`],
    );
    // Marks the city as already imported so the route's internal
    // importCityRestaurants call is a fast no-op, not a live network call.
    await pool.query('INSERT INTO restaurant_import_log (city, place_count) VALUES (?, 1)', [gatedCity]);

    const { status, body } = await api('GET', `/api/restaurants?city=${encodeURIComponent(gatedCity)}`);
    assert.equal(status, 200);
    assert.ok(body.restaurants.some((r) => r.name === 'Pre-seeded Real Place'));

    await pool.query('DELETE FROM restaurants WHERE city = ?', [gatedCity]);
    await pool.query('DELETE FROM restaurant_import_log WHERE city = ?', [gatedCity]);
  });
});
