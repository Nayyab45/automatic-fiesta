import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { profileRouter } from '../../src/routes/profile.js';
import { startTestServer } from '../helpers/testServer.js';
import { stubDbMatching } from '../helpers/mockDb.js';

let server;
let restoreDb = () => {};
let authHeader;

before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  server = await startTestServer(profileRouter);
  const token = jwt.sign({ sub: 1, email: 'jane@example.com' }, process.env.JWT_SECRET);
  authHeader = { authorization: `Bearer ${token}` };
});

after(async () => {
  await server.close();
});

beforeEach(() => {
  restoreDb();
  restoreDb = () => {};
});

async function get(path, headers = {}) {
  const res = await fetch(`${server.baseUrl}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}

// Enough to get fullProfile() through GET /:id without crashing, on top of
// whichever rules a test adds of its own.
const FULL_PROFILE_RULES = [
  { match: 'FROM users WHERE id = ?', get: { id: 2, name: 'Bob', email: 'bob@example.com' } },
  { match: 'COUNT(DISTINCT t.id)', get: { count: 0 } },
  { match: 'AVG(score)', get: { avg: null } },
  { match: 'FROM interests i', all: [] },
];

test('requires auth', async () => {
  const { status } = await get('/2');
  assert.equal(status, 401);
});

describe('GET /:id', () => {
  test('records a profile view even when the viewer has not opted into "show my profile views" (regression: the view count used to never increment because it was gated behind that opt-in, which defaults to off for everyone)', async () => {
    let recordedView = null;
    const stub = stubDbMatching([
      {
        match: 'INSERT INTO profile_views',
        run: (viewerUserId, viewedUserId) => {
          recordedView = { viewerUserId, viewedUserId };
          return { changes: 1 };
        },
      },
      ...FULL_PROFILE_RULES,
    ]);
    restoreDb = stub;

    const { status } = await get('/2', authHeader);

    assert.equal(status, 200);
    assert.deepEqual(recordedView, { viewerUserId: 1, viewedUserId: 2 });
    assert.ok(
      !stub.calls.some((sql) => sql.includes('FROM privacy_settings')),
      'recording a view should no longer consult the privacy_settings table at all',
    );
  });

  test('does not record a view when visiting your own profile', async () => {
    let insertCalled = false;
    restoreDb = stubDbMatching([
      { match: 'INSERT INTO profile_views', run: () => { insertCalled = true; return { changes: 1 }; } },
      { match: 'FROM users WHERE id = ?', get: { id: 1, name: 'Jane', email: 'jane@example.com' } },
      { match: 'COUNT(DISTINCT t.id)', get: { count: 0 } },
      { match: 'AVG(score)', get: { avg: null } },
      { match: 'FROM interests i', all: [] },
    ]);

    const { status } = await get('/1', authHeader);

    assert.equal(status, 200);
    assert.equal(insertCalled, false);
  });

  test('404s for an unknown user', async () => {
    restoreDb = stubDbMatching([{ match: 'FROM users WHERE id = ?', get: null }]);
    const { status } = await get('/999', authHeader);
    assert.equal(status, 404);
  });
});

describe('GET /me/viewers', () => {
  test('only names viewers who opted into showProfileViews, filtered at the SQL level', async () => {
    const stub = stubDbMatching([
      {
        match: 'FROM profile_views pv',
        all: [{ id: 5, name: 'Sam', photo_url: null, verified: 0, viewed_at: '2026-09-20T00:00:00.000Z' }],
      },
    ]);
    restoreDb = stub;

    const { status, body } = await get('/me/viewers', authHeader);

    assert.equal(status, 200);
    assert.equal(body.viewers.length, 1);
    assert.equal(body.viewers[0].id, 5);
    const viewersSql = stub.calls.find((sql) => sql.includes('FROM profile_views pv'));
    assert.match(viewersSql, /show_profile_views/, 'identity list must still respect the per-viewer opt-in');
  });
});
