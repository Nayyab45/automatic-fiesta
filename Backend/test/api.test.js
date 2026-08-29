import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Set before importing server.js/db.js: DB_PATH picks a fresh in-memory
// SQLite database instead of the real dev database in data/app.sqlite, and
// server.js exits immediately if JWT_SECRET is missing. Using a dynamic
// import (rather than a static one, which Node hoists above these
// assignments) is what makes the ordering here actually take effect.
process.env.JWT_SECRET = 'test-secret';
process.env.DB_PATH = ':memory:';

const { app } = await import('../src/server.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

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

async function signup(email) {
  const { body } = await api('POST', '/api/auth/signup', {
    body: { name: 'Test User', email, password: 'password123' },
  });
  return body; // { accessToken, refreshToken, user }
}

describe('auth', () => {
  test('signup issues a session and rejects a duplicate email', async () => {
    const session = await signup('alice@example.com');
    assert.ok(session.accessToken);
    assert.ok(session.refreshToken);
    assert.equal(session.user.email, 'alice@example.com');

    const dup = await api('POST', '/api/auth/signup', {
      body: { name: 'Alice Two', email: 'alice@example.com', password: 'password123' },
    });
    assert.equal(dup.status, 409);
  });

  test('login rejects a wrong password', async () => {
    await signup('bob@example.com');
    const res = await api('POST', '/api/auth/login', { body: { email: 'bob@example.com', password: 'wrong-pass' } });
    assert.equal(res.status, 401);
  });

  test('a garbage access token is rejected by protected routes', async () => {
    const res = await api('GET', '/api/auth/me', { token: 'not-a-real-token' });
    assert.equal(res.status, 401);
  });

  test('refresh rotates the token pair and the used refresh token stops working', async () => {
    const session = await signup('carol@example.com');

    const refreshed = await api('POST', '/api/auth/refresh', { body: { refreshToken: session.refreshToken } });
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.accessToken);
    assert.notEqual(refreshed.body.refreshToken, session.refreshToken);

    const reuse = await api('POST', '/api/auth/refresh', { body: { refreshToken: session.refreshToken } });
    assert.equal(reuse.status, 401);
  });

  test('logout revokes the refresh token', async () => {
    const session = await signup('dave@example.com');

    const out = await api('POST', '/api/auth/logout', { body: { refreshToken: session.refreshToken } });
    assert.equal(out.status, 200);

    const tryRefresh = await api('POST', '/api/auth/refresh', { body: { refreshToken: session.refreshToken } });
    assert.equal(tryRefresh.status, 401);
  });
});

describe('blocking', () => {
  test('blocking a user removes them from /people for both people', async () => {
    const alice = await signup('block-alice@example.com');
    const bob = await signup('block-bob@example.com');
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
    const host = await signup('host@example.com');
    const guest = await signup('guest@example.com');

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
    const host = await signup('self-host@example.com');
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
