import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toCamel, toCamelRows } from '../../src/lib/serialize.js';

describe('toCamel', () => {
  test('converts snake_case keys to camelCase', () => {
    assert.deepEqual(toCamel({ user_id: 1, photo_url: 'a.jpg', name: 'Jane' }), {
      userId: 1,
      photoUrl: 'a.jpg',
      name: 'Jane',
    });
  });

  test('handles multiple underscores and a digit boundary', () => {
    assert.deepEqual(toCamel({ two_factor_auth_id: 5, dish_1_name: 'Nihari' }), {
      twoFactorAuthId: 5,
      dish1Name: 'Nihari',
    });
  });

  test('passes null/undefined through unchanged, instead of throwing', () => {
    assert.equal(toCamel(null), null);
    assert.equal(toCamel(undefined), undefined);
  });

  test('leaves values (including nested objects) untouched', () => {
    const nested = { child_count: 0, meta: { still_snake: true } };
    assert.deepEqual(toCamel(nested), { childCount: 0, meta: { still_snake: true } });
  });
});

describe('toCamelRows', () => {
  test('maps toCamel over every row', () => {
    assert.deepEqual(toCamelRows([{ user_id: 1 }, { user_id: 2 }]), [{ userId: 1 }, { userId: 2 }]);
  });

  test('returns an empty array for an empty array', () => {
    assert.deepEqual(toCamelRows([]), []);
  });
});
