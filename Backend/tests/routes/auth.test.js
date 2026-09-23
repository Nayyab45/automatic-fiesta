import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { authRouter } from '../../src/routes/auth.js';
import { startTestServer } from '../helpers/testServer.js';
import { stubDbSequence, stubDbMatching } from '../helpers/mockDb.js';

let server;
let restoreDb = () => {};

before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  server = await startTestServer(authRouter);
});

after(async () => {
  await server.close();
});

beforeEach(() => {
  restoreDb();
  restoreDb = () => {};
});

async function post(path, body, headers = {}) {
  const res = await fetch(`${server.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(path, headers = {}) {
  const res = await fetch(`${server.baseUrl}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}

async function del(path, headers = {}) {
  const res = await fetch(`${server.baseUrl}${path}`, { method: 'DELETE', headers });
  return { status: res.status, body: await res.json() };
}

describe('POST /signup', () => {
  test('400s when required fields are missing', async () => {
    const { status, body } = await post('/signup', { email: 'jane@example.com' });
    assert.equal(status, 400);
    assert.match(body.message, /required/);
  });

  test('400s on a weak password', async () => {
    const { status, body } = await post('/signup', { name: 'Jane', email: 'jane@example.com', password: 'weak' });
    assert.equal(status, 400);
    assert.match(body.message, /at least 8 characters/);
  });

  test('409s when the email is already registered', async () => {
    restoreDb = stubDbSequence([{ get: { id: 1 } }]);
    const { status, body } = await post('/signup', {
      name: 'Jane',
      email: 'jane@example.com',
      password: 'password1!',
    });
    assert.equal(status, 409);
    assert.match(body.message, /already exists/);
  });

  test('201s with a session and never echoes the password hash', async () => {
    restoreDb = stubDbSequence([
      { get: null }, // existing-email check
      { run: { lastInsertRowid: 7, changes: 1 } }, // INSERT INTO users
      { run: { lastInsertRowid: 1, changes: 1 } }, // INSERT INTO refresh_tokens
    ]);
    const { status, body } = await post('/signup', {
      name: '  Jane  ',
      email: 'JANE@Example.com',
      password: 'password1!',
    });
    assert.equal(status, 201);
    assert.equal(body.user.name, 'Jane');
    assert.equal(body.user.email, 'jane@example.com');
    assert.equal(body.user.isAdmin, false);
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
    assert.equal('passwordHash' in body.user, false);
    assert.equal('password_hash' in body.user, false);
  });
});

describe('POST /login', () => {
  test('400s when required fields are missing', async () => {
    const { status } = await post('/login', { email: 'jane@example.com' });
    assert.equal(status, 400);
  });

  test('401s on a wrong password', async () => {
    const passwordHash = bcrypt.hashSync('correct-password1!', 10);
    restoreDb = stubDbSequence([{ get: { id: 1, email: 'jane@example.com', password_hash: passwordHash } }]);
    const { status, body } = await post('/login', { email: 'jane@example.com', password: 'wrong-password' });
    assert.equal(status, 401);
    assert.equal(body.message, 'Invalid email or password');
  });

  test('401s when the email has no account', async () => {
    restoreDb = stubDbSequence([{ get: null }]);
    const { status } = await post('/login', { email: 'nobody@example.com', password: 'whatever1!' });
    assert.equal(status, 401);
  });

  test('200s with a session when 2FA is not enabled', async () => {
    const passwordHash = bcrypt.hashSync('password1!', 10);
    restoreDb = stubDbSequence([
      { get: { id: 1, name: 'Jane', email: 'jane@example.com', password_hash: passwordHash, isAdmin: 0 } },
      { get: null }, // two_factor_auth lookup -- not enabled
      { run: { lastInsertRowid: 1, changes: 1 } }, // INSERT INTO refresh_tokens
    ]);
    const { status, body } = await post('/login', { email: 'jane@example.com', password: 'password1!' });
    assert.equal(status, 200);
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
    assert.equal(body.twoFactorRequired, undefined);
  });

  test('responds with a challenge (no tokens) when 2FA is enabled', async () => {
    const passwordHash = bcrypt.hashSync('password1!', 10);
    restoreDb = stubDbSequence([
      { get: { id: 1, name: 'Jane', email: 'jane@example.com', password_hash: passwordHash, isAdmin: 0 } },
      { get: { enabled: 1 } },
    ]);
    const { status, body } = await post('/login', { email: 'jane@example.com', password: 'password1!' });
    assert.equal(status, 200);
    assert.equal(body.twoFactorRequired, true);
    assert.ok(body.challengeToken);
    assert.equal(body.accessToken, undefined);
  });

  // Must run last in this describe block -- it burns through (and leaves
  // exhausted) the shared per-server rate-limit bucket for POST /login.
  // Missing fields 400s before any DB call, so no stubbing needed; firing
  // one more than the limiter's window ever allows a single test run to
  // guarantees a 429 regardless of how much budget earlier tests in this
  // file already consumed.
  test('429s once too many login attempts land in the window', async () => {
    // Matches loginLimiter's configured `limit` in src/middleware/rateLimit.js --
    // update this alongside that value if it ever changes.
    const LOGIN_LIMIT = 15;
    let lastStatus;
    for (let i = 0; i < LOGIN_LIMIT + 1; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- must be sequential to actually exhaust the window
      ({ status: lastStatus } = await post('/login', { email: 'jane@example.com' }));
    }
    assert.equal(lastStatus, 429);
  });
});

describe('POST /refresh', () => {
  test('401s on an unknown/invalid refresh token', async () => {
    restoreDb = stubDbSequence([{ get: null }]);
    const { status } = await post('/refresh', { refreshToken: 'not-a-real-token' });
    assert.equal(status, 401);
  });

  test('401s on a revoked refresh token', async () => {
    restoreDb = stubDbSequence([
      { get: { id: 1, user_id: 5, revoked_at: '2024-01-01 00:00:00', expires_at: '2999-01-01T00:00:00.000Z' } },
    ]);
    const { status } = await post('/refresh', { refreshToken: 'some-token' });
    assert.equal(status, 401);
  });

  test('401s on an expired refresh token', async () => {
    restoreDb = stubDbSequence([
      { get: { id: 1, user_id: 5, revoked_at: null, expires_at: '2000-01-01T00:00:00.000Z' } },
    ]);
    const { status } = await post('/refresh', { refreshToken: 'some-token' });
    assert.equal(status, 401);
  });

  test('rotates the token and issues a fresh session', async () => {
    restoreDb = stubDbSequence([
      { get: { id: 1, user_id: 5, revoked_at: null, expires_at: '2999-01-01T00:00:00.000Z' } }, // find token
      { run: { changes: 1 } }, // revoke old token
      { get: { id: 5, name: 'Jane', email: 'jane@example.com', isAdmin: 0 } }, // load user
      { run: { lastInsertRowid: 2, changes: 1 } }, // insert new refresh token
    ]);
    const { status, body } = await post('/refresh', { refreshToken: 'some-token' });
    assert.equal(status, 200);
    assert.ok(body.accessToken);
    assert.equal(body.user.id, 5);
  });
});

describe('GET /me', () => {
  test('401s with no token', async () => {
    const { status } = await get('/me');
    assert.equal(status, 401);
  });

  test('404s when the token is valid but the user no longer exists', async () => {
    const { accessToken } = await signUpAndAuthenticate();
    restoreDb = stubDbSequence([{ get: null }]);
    const { status } = await get('/me', { authorization: `Bearer ${accessToken}` });
    assert.equal(status, 404);
  });

  test("200s with the caller's own user", async () => {
    const { accessToken, userId } = await signUpAndAuthenticate();
    restoreDb = stubDbSequence([{ get: { id: userId, name: 'Jane', email: 'jane@example.com', isAdmin: 0 } }]);
    const { status, body } = await get('/me', { authorization: `Bearer ${accessToken}` });
    assert.equal(status, 200);
    assert.equal(body.user.id, userId);
  });
});

// Signs a real access token the same way the route would, without going
// through the whole signup HTTP round trip for tests that only need a valid
// Authorization header.
async function signUpAndAuthenticate() {
  const jwt = (await import('jsonwebtoken')).default;
  const userId = 99;
  const accessToken = jwt.sign({ sub: userId, email: 'jane@example.com' }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });
  return { accessToken, userId };
}

describe('DELETE /admin/users/:id', () => {
  test('403s a non-admin caller', async () => {
    const { accessToken } = await signUpAndAuthenticate();
    restoreDb = stubDbMatching([{ match: 'is_admin FROM users WHERE id = ?', get: { is_admin: 0 } }]);
    const { status } = await del('/admin/users/5', { authorization: `Bearer ${accessToken}` });
    assert.equal(status, 403);
  });

  test('404s for an unknown target user', async () => {
    const { accessToken } = await signUpAndAuthenticate();
    const stub = stubDbMatching([
      { match: 'SELECT is_admin FROM users WHERE id = ?', get: { is_admin: 1 } },
      { match: 'SELECT id, is_admin FROM users WHERE id = ?', get: null },
    ]);
    restoreDb = stub;
    const { status } = await del('/admin/users/999', { authorization: `Bearer ${accessToken}` });
    assert.equal(status, 404);
  });

  test("400s trying to delete an admin account", async () => {
    const { accessToken } = await signUpAndAuthenticate();
    restoreDb = stubDbMatching([
      { match: 'SELECT is_admin FROM users WHERE id = ?', get: { is_admin: 1 } },
      { match: 'SELECT id, is_admin FROM users WHERE id = ?', get: { id: 5, is_admin: 1 } },
    ]);
    const { status, body } = await del('/admin/users/5', { authorization: `Bearer ${accessToken}` });
    assert.equal(status, 400);
    assert.match(body.message, /admin account/);
  });

  test('200s and cascades the delete across every referencing table for a normal user', async () => {
    const { accessToken } = await signUpAndAuthenticate();
    const deletedFrom = [];
    const stub = stubDbMatching(
      [
        { match: 'SELECT is_admin FROM users WHERE id = ?', get: { is_admin: 1 } },
        { match: 'SELECT id, is_admin FROM users WHERE id = ?', get: { id: 5, is_admin: 0 } },
      ],
      {
        run: (...args) => {
          deletedFrom.push(args);
          return { changes: 1 };
        },
      },
    );
    restoreDb = stub;
    const { status, body } = await del('/admin/users/5', { authorization: `Bearer ${accessToken}` });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    // deleteUserAccount fires 13 DELETE statements (12 referencing tables + users itself).
    assert.equal(deletedFrom.length, 13);
    assert.ok(
      stub.calls.some((sql) => sql.includes('DELETE FROM users WHERE id = ?')),
      'must actually delete the users row, not just its related data',
    );
  });
});
