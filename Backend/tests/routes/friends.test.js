import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { friendsRouter } from '../../src/routes/friends.js';
import { startTestServer } from '../helpers/testServer.js';
import { stubDbSequence } from '../helpers/mockDb.js';

let server;
let restoreDb = () => {};
let authHeader;

before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  server = await startTestServer(friendsRouter);
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

async function post(path, body, headers = {}) {
  const res = await fetch(`${server.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await res.json() };
}

test('every route under /friends requires auth', async () => {
  const { status } = await get('/');
  assert.equal(status, 401);
});

describe('GET /status/:userId', () => {
  test('none when there is no request between the two users', async () => {
    restoreDb = stubDbSequence([{ get: null }]);
    const { status, body } = await get('/status/2', authHeader);
    assert.equal(status, 200);
    assert.deepEqual(body, { status: 'none' });
  });

  test('friends once the pair is accepted', async () => {
    restoreDb = stubDbSequence([{ get: { id: 5, status: 'accepted', requester_id: 1, recipient_id: 2 } }]);
    const { body } = await get('/status/2', authHeader);
    assert.equal(body.status, 'friends');
    assert.equal(body.requestId, 5);
  });

  test('pending_sent when the caller sent it', async () => {
    restoreDb = stubDbSequence([{ get: { id: 5, status: 'pending', requester_id: 1, recipient_id: 2 } }]);
    const { body } = await get('/status/2', authHeader);
    assert.equal(body.status, 'pending_sent');
  });

  test('pending_received when the other user sent it', async () => {
    restoreDb = stubDbSequence([{ get: { id: 5, status: 'pending', requester_id: 2, recipient_id: 1 } }]);
    const { body } = await get('/status/2', authHeader);
    assert.equal(body.status, 'pending_received');
  });
});

describe('POST /requests', () => {
  test('400s when recipientId is missing', async () => {
    const { status } = await post('/requests', {}, authHeader);
    assert.equal(status, 400);
  });

  test("400s trying to friend yourself", async () => {
    const { status, body } = await post('/requests', { recipientId: 1 }, authHeader);
    assert.equal(status, 400);
    assert.match(body.message, /yourself/);
  });

  test('403s when either side has blocked the other', async () => {
    restoreDb = stubDbSequence([{ get: { blocker_user_id: 2, blocked_user_id: 1 } }]);
    const { status } = await post('/requests', { recipientId: 2 }, authHeader);
    assert.equal(status, 403);
  });

  test('201s and notifies the recipient on a fresh request', async () => {
    restoreDb = stubDbSequence([
      { get: null }, // not blocked
      { get: null }, // no existing pair
      { run: { lastInsertRowid: 9, changes: 1 } }, // INSERT INTO friend_requests
      { run: { lastInsertRowid: 100, changes: 1 } }, // createNotification: INSERT INTO notifications
      { get: { name: 'Jane' } }, // createNotification: actor name lookup
      { all: [] }, // sendPushToUser's device_tokens lookup, only reached if Firebase is configured locally
    ]);
    const { status, body } = await post('/requests', { recipientId: 2 }, authHeader);
    assert.equal(status, 201);
    assert.equal(body.status, 'pending_sent');
    assert.equal(body.requestId, 9);
  });

  test('auto-accepts when the other user already requested you', async () => {
    restoreDb = stubDbSequence([
      { get: null }, // not blocked
      { get: { id: 9, status: 'pending', requester_id: 2, recipient_id: 1 } }, // existing pair, they sent it
      { run: { changes: 1 } }, // UPDATE ... accepted
      { run: { lastInsertRowid: 100, changes: 1 } }, // createNotification insert
      { get: { name: 'Jane' } }, // createNotification actor lookup
      { all: [] }, // sendPushToUser's device_tokens lookup, only reached if Firebase is configured locally
    ]);
    const { status, body } = await post('/requests', { recipientId: 2 }, authHeader);
    assert.equal(status, 200);
    assert.equal(body.status, 'friends');
  });
});

describe('POST /requests/:id/accept', () => {
  test('404s when there is no matching pending request for this recipient', async () => {
    restoreDb = stubDbSequence([{ get: null }]);
    const { status } = await post('/requests/5/accept', {}, authHeader);
    assert.equal(status, 404);
  });

  test('accepts and notifies the original requester', async () => {
    restoreDb = stubDbSequence([
      { get: { id: 5, requester_id: 2, recipient_id: 1, status: 'pending' } },
      { run: { changes: 1 } }, // UPDATE ... accepted
      { run: { lastInsertRowid: 100, changes: 1 } }, // createNotification insert
      { get: { name: 'Jane' } }, // createNotification actor lookup
      { all: [] }, // sendPushToUser's device_tokens lookup, only reached if Firebase is configured locally
    ]);
    const { status, body } = await post('/requests/5/accept', {}, authHeader);
    assert.equal(status, 200);
    assert.equal(body.status, 'friends');
  });
});
