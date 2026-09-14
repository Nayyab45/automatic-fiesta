import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
// server.js normally binds a port on import; this suite imports `app` and
// calls app.listen(0) itself per test file instead, so each gets its own
// ephemeral port rather than colliding with a dev server already on 3000.
process.env.SKIP_SERVER_LISTEN = 'true';

const { app } = await import('../src/server.js');
const { initSchema, pool, db } = await import('../src/db.js');
const { importCityRestaurants } = await import('../src/lib/osmPlaces.js');
const { getRealPlacePhoto, getOrCreateCuisinePhoto, enhancePhoto } = await import('../src/lib/restaurantPhotos.js');
const { Jimp } = await import('jimp');

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
  ['restaurant_reviews', 'reviewer_user_id'],
  ['preference_updates', 'user_id'],
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
    for (const table of ['table_guests', 'seat_requests', 'check_ins', 'reviews', 'user_ratings', 'table_messages', 'notifications']) {
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

    const hostList = await api('GET', `/api/tables/${table.body.table.id}/seat-requests`, { token: host.accessToken });
    assert.equal(hostList.status, 200);
    assert.ok(hostList.body.seatRequests.some((r) => r.id === seatReq.body.seatRequest.id && r.userName === 'Test User'));

    const guestList = await api('GET', `/api/tables/${table.body.table.id}/seat-requests`, { token: guest.accessToken });
    assert.equal(guestList.status, 403);
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

describe('reviews', () => {
  test('a table member can list reviews; a non-member cannot', async () => {
    const host = await signup('review-host');
    const guest = await signup('review-guest');
    const stranger = await signup('review-stranger');

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
    const tableId = table.body.table.id;

    const seatReq = await api('POST', `/api/tables/${tableId}/seat-requests`, { token: guest.accessToken, body: {} });
    await api('PATCH', `/api/seat-requests/${seatReq.body.seatRequest.id}`, {
      token: host.accessToken,
      body: { status: 'confirmed' },
    });

    const review = await api('POST', `/api/tables/${tableId}/reviews`, {
      token: guest.accessToken,
      body: { foodRating: 5, restaurantRating: 4, conversationRating: 5, overallRating: 5, dineAgain: 'yes', comment: 'Great time!' },
    });
    assert.equal(review.status, 201);

    const hostView = await api('GET', `/api/tables/${tableId}/reviews`, { token: host.accessToken });
    assert.equal(hostView.status, 200);
    assert.ok(hostView.body.reviews.some((r) => r.comment === 'Great time!' && r.reviewerName === 'Test User'));

    const strangerView = await api('GET', `/api/tables/${tableId}/reviews`, { token: stranger.accessToken });
    assert.equal(strangerView.status, 403);
  });
});

describe('people ratings', () => {
  async function pastTableWith(hostToken, guestToken) {
    const restaurants = await api('GET', '/api/restaurants', { token: hostToken });
    const restaurantId = restaurants.body.restaurants[0].id;
    const table = await api('POST', '/api/tables', {
      token: hostToken,
      body: {
        restaurantId,
        gatheringType: 'dinner',
        dateTime: new Date(Date.now() - 86400000).toISOString(),
        seatsTotal: 4,
      },
    });
    const tableId = table.body.table.id;
    const seatReq = await api('POST', `/api/tables/${tableId}/seat-requests`, { token: guestToken, body: {} });
    await api('PATCH', `/api/seat-requests/${seatReq.body.seatRequest.id}`, {
      token: hostToken,
      body: { status: 'confirmed' },
    });
    return tableId;
  }

  test('fellow attendees of a past table can rate each other, and the average shows on the profile', async () => {
    const host = await signup('rate-host');
    const guest = await signup('rate-guest');
    const tableId = await pastTableWith(host.accessToken, guest.accessToken);

    const rateable = await api('GET', `/api/tables/${tableId}/rateable`, { token: guest.accessToken });
    assert.equal(rateable.status, 200);
    assert.ok(rateable.body.people.some((p) => p.id === host.user.id && p.myRating === null));

    const rate = await api('POST', `/api/tables/${tableId}/rate`, {
      token: guest.accessToken,
      body: { ratedUserId: host.user.id, score: 5 },
    });
    assert.equal(rate.status, 200);

    // Re-rating the same person for the same table edits rather than duplicating.
    const rateAgain = await api('POST', `/api/tables/${tableId}/rate`, {
      token: guest.accessToken,
      body: { ratedUserId: host.user.id, score: 4 },
    });
    assert.equal(rateAgain.status, 200);

    const hostProfile = await api('GET', `/api/profile/${host.user.id}`, { token: guest.accessToken });
    assert.equal(hostProfile.body.profile.rating, 4);

    const rateableAfter = await api('GET', `/api/tables/${tableId}/rateable`, { token: guest.accessToken });
    assert.equal(rateableAfter.body.people.find((p) => p.id === host.user.id).myRating, 4);
  });

  test('a stranger who never shared the table cannot rate either attendee', async () => {
    const host = await signup('rate-host2');
    const guest = await signup('rate-guest2');
    const stranger = await signup('rate-stranger');
    const tableId = await pastTableWith(host.accessToken, guest.accessToken);

    const strangerRateable = await api('GET', `/api/tables/${tableId}/rateable`, { token: stranger.accessToken });
    assert.equal(strangerRateable.status, 403);

    const strangerRate = await api('POST', `/api/tables/${tableId}/rate`, {
      token: stranger.accessToken,
      body: { ratedUserId: host.user.id, score: 5 },
    });
    assert.equal(strangerRate.status, 403);
  });

  test("rating is rejected for a table that hasn't happened yet, and for an out-of-range score", async () => {
    const host = await signup('rate-host3');
    const guest = await signup('rate-guest3');

    const restaurants = await api('GET', '/api/restaurants', { token: host.accessToken });
    const table = await api('POST', '/api/tables', {
      token: host.accessToken,
      body: {
        restaurantId: restaurants.body.restaurants[0].id,
        gatheringType: 'dinner',
        dateTime: new Date(Date.now() + 86400000).toISOString(),
        seatsTotal: 4,
      },
    });
    const tableId = table.body.table.id;
    const seatReq = await api('POST', `/api/tables/${tableId}/seat-requests`, { token: guest.accessToken, body: {} });
    await api('PATCH', `/api/seat-requests/${seatReq.body.seatRequest.id}`, {
      token: host.accessToken,
      body: { status: 'confirmed' },
    });

    const tooSoon = await api('POST', `/api/tables/${tableId}/rate`, {
      token: guest.accessToken,
      body: { ratedUserId: host.user.id, score: 5 },
    });
    assert.equal(tooSoon.status, 400);

    // Backdate it directly (no API surface for editing dateTime) so the
    // remaining assertion isolates the score-range validation specifically.
    await pool.query('UPDATE dining_tables SET date_time = ? WHERE id = ?', [
      new Date(Date.now() - 86400000).toISOString(),
      tableId,
    ]);
    const badScore = await api('POST', `/api/tables/${tableId}/rate`, {
      token: guest.accessToken,
      body: { ratedUserId: host.user.id, score: 6 },
    });
    assert.equal(badScore.status, 400);
  });
});

describe('restaurant reviews', () => {
  // A dedicated throwaway restaurant per test (rather than reusing a real
  // seeded/imported one) so mutating its rating/review_count here can never
  // leak into shared data another test or a real request depends on.
  async function createTestRestaurant() {
    const [result] = await pool.query(
      `INSERT INTO restaurants (name, city, region, cuisine_tags, source, external_id)
       VALUES (?, 'Test City', 'Test Region', 'Restaurant', 'osm', ?)`,
      [`Review Test Place ${RUN_TAG}`, `osm:node/${randomUUID()}`],
    );
    return result.insertId;
  }

  test('posting a review is public to read, sets the restaurant\'s real rating, and editing replaces rather than duplicates', async () => {
    const restaurantId = await createTestRestaurant();
    const reviewer = await signup('restaurant-reviewer');

    const before = await api('GET', `/api/restaurants/${restaurantId}`);
    assert.equal(before.body.restaurant.rating, null);

    const created = await api('POST', `/api/restaurants/${restaurantId}/reviews`, {
      token: reviewer.accessToken,
      body: { rating: 5, comment: 'Loved it' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.review.rating, 5);

    const afterOne = await api('GET', `/api/restaurants/${restaurantId}`);
    assert.equal(afterOne.body.restaurant.rating, 5);
    assert.equal(afterOne.body.restaurant.reviewCount, 1);

    // No auth required to read -- unlike a table's reviews, this is meant to
    // be visible to anyone deciding whether to go.
    const publicList = await api('GET', `/api/restaurants/${restaurantId}/reviews`);
    assert.equal(publicList.status, 200);
    assert.equal(publicList.body.reviews.length, 1);
    assert.equal(publicList.body.reviews[0].reviewerName, 'Test User');

    const edited = await api('POST', `/api/restaurants/${restaurantId}/reviews`, {
      token: reviewer.accessToken,
      body: { rating: 3, comment: 'Changed my mind' },
    });
    assert.equal(edited.status, 201);

    const afterEdit = await api('GET', `/api/restaurants/${restaurantId}/reviews`);
    assert.equal(afterEdit.body.reviews.length, 1, 'editing should replace the existing review, not add a second one');
    assert.equal(afterEdit.body.reviews[0].rating, 3);

    const restaurantAfterEdit = await api('GET', `/api/restaurants/${restaurantId}`);
    assert.equal(restaurantAfterEdit.body.restaurant.rating, 3);

    await pool.query('DELETE FROM restaurants WHERE id = ?', [restaurantId]);
  });

  test('rejects a rating outside 1-5, and deleting the only review resets the restaurant to "not yet rated"', async () => {
    const restaurantId = await createTestRestaurant();
    const reviewer = await signup('restaurant-reviewer-2');

    const invalid = await api('POST', `/api/restaurants/${restaurantId}/reviews`, {
      token: reviewer.accessToken,
      body: { rating: 6 },
    });
    assert.equal(invalid.status, 400);

    const unauthenticated = await api('POST', `/api/restaurants/${restaurantId}/reviews`, { body: { rating: 4 } });
    assert.equal(unauthenticated.status, 401);

    await api('POST', `/api/restaurants/${restaurantId}/reviews`, { token: reviewer.accessToken, body: { rating: 4 } });
    const deleted = await api('DELETE', `/api/restaurants/${restaurantId}/reviews`, { token: reviewer.accessToken });
    assert.equal(deleted.status, 200);

    const after = await api('GET', `/api/restaurants/${restaurantId}`);
    assert.equal(after.body.restaurant.rating, null);
    assert.equal(after.body.restaurant.reviewCount, null);

    await pool.query('DELETE FROM restaurants WHERE id = ?', [restaurantId]);
  });
});

describe('preference change limit', () => {
  const preferencesPayload = (n) => ({
    favoriteFoods: [`Food ${n}`],
    needs: [],
    spiceTolerance: 'Medium',
    maxDistanceKm: 10,
    diningTimes: ['Dinner'],
  });

  test('caps Edit Preferences saves at 2/month, 3rd is blocked with a clear message, onboarding endpoints stay unaffected', async () => {
    const user = await signup('preference-limits');

    const initial = await api('GET', '/api/profile/me', { token: user.accessToken });
    assert.equal(initial.body.preferenceChanges.remaining, 2);

    const first = await api('PUT', '/api/profile/me/preferences', { token: user.accessToken, body: preferencesPayload(1) });
    assert.equal(first.status, 200);
    assert.equal(first.body.preferenceChanges.remaining, 1);

    const second = await api('PUT', '/api/profile/me/preferences', { token: user.accessToken, body: preferencesPayload(2) });
    assert.equal(second.status, 200);
    assert.equal(second.body.preferenceChanges.remaining, 0);

    const third = await api('PUT', '/api/profile/me/preferences', { token: user.accessToken, body: preferencesPayload(3) });
    assert.equal(third.status, 429);
    assert.match(third.body.message, /2 preference changes/);
    assert.equal(third.body.preferenceChanges.remaining, 0);

    // The third attempt's payload must not have been applied.
    const afterBlocked = await api('GET', '/api/profile/me', { token: user.accessToken });
    assert.deepEqual(afterBlocked.body.profile.favoriteFoods, ['Food 2']);

    // Onboarding steps (first-time setup, not a "change") are a different
    // endpoint entirely and stay unaffected once the monthly limit is hit.
    const onboarding = await api('PUT', '/api/profile/me/food-preferences', {
      token: user.accessToken,
      body: { favoriteFoods: ['Onboarding Food'] },
    });
    assert.equal(onboarding.status, 200);
  });
});

describe('people matching', () => {
  test('food/taste dominates score, and same-city candidates rank above out-of-city ones regardless of score', async () => {
    const me = await signup('match-me');
    const sameCityTasteMatch = await signup('match-same-city');
    const otherCityInterestMatch = await signup('match-other-city');

    await api('PUT', '/api/profile/me', { token: me.accessToken, body: { city: 'MatchTestCity' } });
    await api('PUT', '/api/profile/me', { token: sameCityTasteMatch.accessToken, body: { city: 'MatchTestCity' } });
    await api('PUT', '/api/profile/me', { token: otherCityInterestMatch.accessToken, body: { city: 'SomeOtherCity' } });

    await api('PUT', '/api/profile/me/food-preferences', {
      token: me.accessToken,
      body: { favoriteFoods: ['Biryani', 'Karahi'] },
    });
    await api('PUT', '/api/profile/me/food-preferences', {
      token: sameCityTasteMatch.accessToken,
      body: { favoriteFoods: ['Biryani', 'Karahi'] },
    });

    const interests = await api('GET', '/api/interests', { token: me.accessToken });
    const interestIds = interests.body.interests.slice(0, 3).map((i) => i.id);
    await api('PUT', '/api/profile/me/interests', { token: me.accessToken, body: { interestIds } });
    // Shares every one of "me"'s interests but no food overlap and a
    // different city -- should still rank below the same-city taste match.
    await api('PUT', '/api/profile/me/interests', {
      token: otherCityInterestMatch.accessToken,
      body: { interestIds },
    });

    const result = await api('GET', '/api/matches', { token: me.accessToken });
    assert.equal(result.status, 200);

    const sameCityEntry = result.body.matches.find((m) => m.id === sameCityTasteMatch.user.id);
    const otherCityEntry = result.body.matches.find((m) => m.id === otherCityInterestMatch.user.id);
    assert.ok(sameCityEntry);
    assert.ok(otherCityEntry);

    // Taste dominates: 2 shared foods (2*25=50) beats 3 shared interests (3*5=15).
    assert.ok(sameCityEntry.score > otherCityEntry.score);
    assert.equal(sameCityEntry.sameCity, true);
    assert.equal(otherCityEntry.sameCity, false);
    assert.ok(sameCityEntry.reasons[0].includes('Biryani'));

    // Same-city group ranks entirely above the other-city group, even
    // though this test's own out-of-city candidate scores far from zero.
    const sameCityIndex = result.body.matches.indexOf(sameCityEntry);
    const otherCityIndex = result.body.matches.indexOf(otherCityEntry);
    assert.ok(sameCityIndex < otherCityIndex);
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

  test('two near-simultaneous requests for the same pair both resolve cleanly instead of one 500ing', async () => {
    const julia = await signup('friend-julia');
    const kevin = await signup('friend-kevin');

    // Both fire before either's INSERT can commit, racing past the
    // "no existing row" check the same way -- this is what used to make the
    // loser hit the table's unique constraint as an unhandled 500.
    const [first, second] = await Promise.all([
      api('POST', '/api/friends/requests', { token: julia.accessToken, body: { recipientId: kevin.user.id } }),
      api('POST', '/api/friends/requests', { token: julia.accessToken, body: { recipientId: kevin.user.id } }),
    ]);

    for (const res of [first, second]) {
      assert.ok([200, 201].includes(res.status), `expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.status, 'pending_sent');
    }
    assert.equal(first.body.requestId, second.body.requestId);

    const status = await api('GET', `/api/friends/status/${kevin.user.id}`, { token: julia.accessToken });
    assert.equal(status.body.status, 'pending_sent');
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
      fetchRealPhoto: async () => null,
      fetchCuisinePhoto: async (_db, cuisineTags) => ({
        url: `https://example.com/stock/${cuisineTags}.jpg`,
        attribution: `Photo by Someone, CC BY 4.0`,
      }),
    });
    assert.equal(result.imported, 2);

    const [rows] = await pool.query('SELECT * FROM restaurants WHERE city = ? ORDER BY name', [testCity]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].source, 'osm');
    assert.equal(rows[0].external_id, 'osm:node/111');
    assert.equal(rows[0].cuisine_tags, 'Pakistani,Bbq');
    assert.equal(rows[0].rating, null);
    assert.equal(rows[0].photo_url, 'https://example.com/stock/Pakistani,Bbq.jpg');
    assert.equal(rows[0].photo_attribution, 'Photo by Someone, CC BY 4.0');
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

// Also no live network here -- fetchImage is stubbed with an in-memory image
// on every call, never a real Openverse/OpenStreetMap request.
describe('restaurant photo enhancement', () => {
  const testCuisine = `Test Cuisine ${RUN_TAG}`;
  const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'images', 'restaurants');

  after(async () => {
    await pool.query('DELETE FROM cuisine_stock_photos WHERE cuisine = ?', [testCuisine]);
    await rm(path.join(IMAGES_DIR, 'osm-node-12345.jpg'), { force: true });
    const leftoverCuisineFiles = (await readdir(IMAGES_DIR)).filter((f) => f.startsWith('cuisine-test-cuisine-'));
    await Promise.all(leftoverCuisineFiles.map((f) => rm(path.join(IMAGES_DIR, f), { force: true })));
  });

  async function tinySourceImageBuffer() {
    const image = new Jimp({ width: 40, height: 20, color: 0x3366ccff });
    return image.getBuffer('image/png');
  }

  test('enhancePhoto crops to a consistent 800x600 landscape ratio', async () => {
    const enhanced = await enhancePhoto(await tinySourceImageBuffer());
    const image = await Jimp.fromBuffer(enhanced);
    assert.equal(image.bitmap.width, 800);
    assert.equal(image.bitmap.height, 600);
  });

  test('getRealPlacePhoto returns null when the fetch turns up nothing, without throwing', async () => {
    const photo = await getRealPlacePhoto(
      { type: 'node', id: 999 },
      { name: 'No Photo Place' },
      { fetchImage: async () => null },
    );
    assert.equal(photo, null);
  });

  test('getRealPlacePhoto stores and returns an enhanced, attributed photo when one is found', async () => {
    const photo = await getRealPlacePhoto(
      { type: 'node', id: 12345 },
      { name: 'Real Photo Place', image: 'https://example.com/photo.jpg' },
      { fetchImage: async () => ({ buffer: await tinySourceImageBuffer(), attribution: 'Photo via OpenStreetMap contributors' }) },
    );
    assert.match(photo.url, /\/images\/restaurants\/osm-node-12345\.jpg$/);
    assert.equal(photo.attribution, 'Photo via OpenStreetMap contributors');
  });

  test('getOrCreateCuisinePhoto caches per slot, and different slots get different photos', async () => {
    let fetchCalls = 0;
    const fetchImage = async () => {
      fetchCalls++;
      return { buffer: await tinySourceImageBuffer(), attribution: `Photo by Someone ${fetchCalls}, CC BY 4.0` };
    };

    const slot0First = await getOrCreateCuisinePhoto(db, testCuisine, 0, { fetchImage });
    const slot0Second = await getOrCreateCuisinePhoto(db, testCuisine, 0, { fetchImage });
    const slot1 = await getOrCreateCuisinePhoto(db, testCuisine, 1, { fetchImage });

    // One fetch per distinct slot -- slot 0's second call is served from cache.
    assert.equal(fetchCalls, 2);
    assert.deepEqual(slot0First, slot0Second);
    assert.notEqual(slot0First.url, slot1.url);
    assert.match(slot0First.url, /\/images\/restaurants\/cuisine-.*\.jpg$/);
  });
});
