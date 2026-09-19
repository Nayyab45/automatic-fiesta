import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { restaurantsRouter } from '../../src/routes/restaurants.js';
import { startTestServer } from '../helpers/testServer.js';
import { stubDbSequence, stubDbAlways } from '../helpers/mockDb.js';

let server;
let restoreDb = () => {};
let authHeader;

before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  server = await startTestServer(restaurantsRouter);
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

describe('GET /featured-dishes', () => {
  test('returns the dishes as-is (camelCased) with no auth required', async () => {
    restoreDb = stubDbSequence([{ all: [{ id: 1, restaurant_name: 'Cafe Aylanto', is_featured: 1 }] }]);
    const { status, body } = await get('/featured-dishes');
    assert.equal(status, 200);
    assert.deepEqual(body.dishes, [{ id: 1, restaurantName: 'Cafe Aylanto', isFeatured: 1 }]);
  });
});

describe('GET /', () => {
  test('returns an empty list without querying for dishes when nothing matches', async () => {
    restoreDb = stubDbSequence([{ all: [] }]);
    const { status, body } = await get('/');
    assert.equal(status, 200);
    assert.deepEqual(body.restaurants, []);
  });

  test('attaches up to 3 popular dishes per restaurant', async () => {
    restoreDb = stubDbSequence([
      { all: [{ id: 1, name: 'Cafe Aylanto', cuisine_tags: 'Italian' }] },
      {
        all: [
          { id: 10, restaurant_id: 1, name: 'A', is_popular: 1 },
          { id: 11, restaurant_id: 1, name: 'B', is_popular: 1 },
        ],
      },
    ]);
    const { status, body } = await get('/');
    assert.equal(status, 200);
    assert.equal(body.restaurants.length, 1);
    assert.equal(body.restaurants[0].dishes.length, 2);
  });
});

describe('GET /:id', () => {
  test('404s for an unknown restaurant', async () => {
    restoreDb = stubDbSequence([{ get: null }]);
    const { status, body } = await get('/999');
    assert.equal(status, 404);
    assert.match(body.message, /not found/);
  });

  test('200s with the restaurant and its dishes', async () => {
    restoreDb = stubDbSequence([
      { get: { id: 1, name: 'Cafe Aylanto' } },
      { all: [{ id: 10, restaurant_id: 1, name: 'Karahi' }] },
    ]);
    const { status, body } = await get('/1');
    assert.equal(status, 200);
    assert.equal(body.restaurant.name, 'Cafe Aylanto');
    assert.equal(body.restaurant.dishes.length, 1);
  });
});

describe('POST /:id/reviews', () => {
  test('requires auth', async () => {
    const { status } = await post('/1/reviews', { rating: 5 });
    assert.equal(status, 401);
  });

  test('404s for an unknown restaurant', async () => {
    restoreDb = stubDbSequence([{ get: null }]);
    const { status } = await post('/999/reviews', { rating: 5 }, authHeader);
    assert.equal(status, 404);
  });

  test('400s when rating is missing', async () => {
    restoreDb = stubDbSequence([{ get: { id: 1 } }]);
    const { status, body } = await post('/1/reviews', {}, authHeader);
    assert.equal(status, 400);
    assert.match(body.message, /required/);
  });

  test('400s when rating is out of range', async () => {
    restoreDb = stubDbSequence([{ get: { id: 1 } }]);
    const { status, body } = await post('/1/reviews', { rating: 7 }, authHeader);
    assert.equal(status, 400);
    assert.match(body.message, /1 to 5/);
  });

  test('400s when rating is not a whole number', async () => {
    restoreDb = stubDbSequence([{ get: { id: 1 } }]);
    const { status } = await post('/1/reviews', { rating: 3.5 }, authHeader);
    assert.equal(status, 400);
  });

  test('201s and recomputes the restaurant rating on a valid review', async () => {
    restoreDb = stubDbAlways({
      get: { id: 1, restaurant_id: 1, reviewer_user_id: 1, rating: 5, reviewer_name: 'Jane', avgRating: 5, reviewCount: 1 },
      run: { lastInsertRowid: 1, changes: 1 },
    });
    const { status, body } = await post('/1/reviews', { rating: 5, comment: 'Great!' }, authHeader);
    assert.equal(status, 201);
    assert.equal(body.review.rating, 5);
  });
});

describe('POST /group-recommendation', () => {
  test('requires auth', async () => {
    const { status } = await post('/group-recommendation', { memberIds: [2] });
    assert.equal(status, 401);
  });

  test('400s with no member ids', async () => {
    const { status, body } = await post('/group-recommendation', { memberIds: [] }, authHeader);
    assert.equal(status, 400);
    assert.match(body.message, /at least one friend/);
  });

  test("403s when a requested member isn't actually a friend", async () => {
    restoreDb = stubDbSequence([{ all: [] }]); // friendIdsOf -> no friends
    const { status, body } = await post('/group-recommendation', { memberIds: [2] }, authHeader);
    assert.equal(status, 403);
    assert.match(body.message, /only include friends/);
  });
});
