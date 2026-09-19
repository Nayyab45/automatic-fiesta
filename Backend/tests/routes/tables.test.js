import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { tablesRouter } from '../../src/routes/tables.js';
import { startTestServer } from '../helpers/testServer.js';
import { stubDbSequence } from '../helpers/mockDb.js';

let server;
let restoreDb = () => {};
let authHeader;

before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  server = await startTestServer(tablesRouter);
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

async function post(path, body, headers = {}) {
  const res = await fetch(`${server.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await res.json() };
}

test('check-in requires auth', async () => {
  const { status } = await post('/1/check-in', {});
  assert.equal(status, 401);
});

describe('POST /:id/check-in', () => {
  test('404s when the table does not exist', async () => {
    restoreDb = stubDbSequence([{ get: null }]);
    const { status } = await post('/999/check-in', {}, authHeader);
    assert.equal(status, 404);
  });

  test("403s a user who never requested a seat", async () => {
    restoreDb = stubDbSequence([
      { get: { id: 1, host_user_id: 2 } }, // table, hosted by someone else
      { get: null }, // not in table_guests
    ]);
    const { status, body } = await post('/1/check-in', {}, authHeader);
    assert.equal(status, 403);
    assert.match(body.message, /confirmed guest/);
  });

  test('403s a user whose seat request is still pending (not yet accepted)', async () => {
    // A 'sent'/pending seat_requests row is never reflected in table_guests
    // until the host confirms it (see seatRequestsRouter's PATCH /:id), so
    // isTableMember sees the same "not a member" state as no request at all.
    restoreDb = stubDbSequence([
      { get: { id: 1, host_user_id: 2 } },
      { get: null }, // still no table_guests row while the request is pending
    ]);
    const { status } = await post('/1/check-in', {}, authHeader);
    assert.equal(status, 403);
  });

  test('403s a user whose seat request was declined', async () => {
    restoreDb = stubDbSequence([
      { get: { id: 1, host_user_id: 2 } },
      { get: null }, // declined requests never get a table_guests row either
    ]);
    const { status } = await post('/1/check-in', {}, authHeader);
    assert.equal(status, 403);
  });

  test('200s for the host', async () => {
    restoreDb = stubDbSequence([
      { get: { id: 1, host_user_id: 1 } }, // caller is the host
      { run: { changes: 1 } }, // INSERT IGNORE INTO check_ins
      { get: { id: 10, table_id: 1, user_id: 1, checked_in_at: '2026-09-19T12:00:00.000Z', checked_out_at: null } },
    ]);
    const { status, body } = await post('/1/check-in', {}, authHeader);
    assert.equal(status, 200);
    assert.equal(body.checkIn.userId, 1);
  });

  test('200s for a confirmed guest', async () => {
    restoreDb = stubDbSequence([
      { get: { id: 1, host_user_id: 2 } },
      { get: { 1: 1 } }, // present in table_guests
      { run: { changes: 1 } },
      { get: { id: 11, table_id: 1, user_id: 1, checked_in_at: '2026-09-19T12:00:00.000Z', checked_out_at: null } },
    ]);
    const { status, body } = await post('/1/check-in', {}, authHeader);
    assert.equal(status, 200);
    assert.equal(body.checkIn.userId, 1);
  });
});
