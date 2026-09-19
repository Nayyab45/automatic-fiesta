import { test, describe, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../../src/middleware/auth.js';

// requireAuth reads process.env.JWT_SECRET at call time, not import time, so
// setting it here (rather than relying on a real .env) is enough.
before(() => {
  process.env.JWT_SECRET = 'test-secret';
});

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = mock.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = mock.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('requireAuth', () => {
  test('401s with no Authorization header', () => {
    const req = { headers: {} };
    const res = fakeRes();
    const next = mock.fn();

    requireAuth(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Missing authorization token');
    assert.equal(next.mock.callCount(), 0);
  });

  test('401s on a header that is not a Bearer token', () => {
    const req = { headers: { authorization: 'Basic somecreds' } };
    const res = fakeRes();
    const next = mock.fn();

    requireAuth(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
  });

  test('401s on a malformed/tampered token', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = fakeRes();
    const next = mock.fn();

    requireAuth(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Invalid or expired token');
    assert.equal(next.mock.callCount(), 0);
  });

  test('401s on an expired token', () => {
    const expired = jwt.sign({ sub: 1 }, process.env.JWT_SECRET, { expiresIn: -1 });
    const req = { headers: { authorization: `Bearer ${expired}` } };
    const res = fakeRes();
    const next = mock.fn();

    requireAuth(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
  });

  test('401s a token signed with a different secret', () => {
    const wrongSecret = jwt.sign({ sub: 1 }, 'some-other-secret');
    const req = { headers: { authorization: `Bearer ${wrongSecret}` } };
    const res = fakeRes();
    const next = mock.fn();

    requireAuth(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
  });

  test('attaches the decoded payload to req.user and calls next() for a valid token', () => {
    const token = jwt.sign({ sub: 42, email: 'jane@example.com' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    const next = mock.fn();

    requireAuth(req, res, next);

    assert.equal(next.mock.callCount(), 1);
    assert.equal(req.user.sub, 42);
    assert.equal(req.user.email, 'jane@example.com');
    assert.equal(res.status.mock.callCount(), 0);
  });
});
