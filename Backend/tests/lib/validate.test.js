import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireFields, isNonEmptyString, isOneOf, passwordStrengthError } from '../../src/lib/validate.js';

describe('requireFields', () => {
  test('lists every missing field, singular phrasing for one', () => {
    assert.equal(requireFields({ name: 'Jane' }, ['name', 'email']), 'email is required');
  });

  test('lists every missing field, plural phrasing for several', () => {
    assert.equal(requireFields({}, ['name', 'email']), 'name, email are required');
  });

  test('treats null and empty string as missing, same as undefined', () => {
    assert.equal(requireFields({ name: null, email: '' }, ['name', 'email']), 'name, email are required');
  });

  test('returns null when every field is present', () => {
    assert.equal(requireFields({ name: 'Jane', email: 'jane@example.com' }, ['name', 'email']), null);
  });

  test('treats falsy-but-present values (0, false) as present', () => {
    assert.equal(requireFields({ count: 0, active: false }, ['count', 'active']), null);
  });

  test('handles a missing/undefined body without throwing', () => {
    assert.equal(requireFields(undefined, ['name']), 'name is required');
  });
});

describe('isNonEmptyString', () => {
  test('rejects non-strings', () => {
    assert.equal(isNonEmptyString(42), false);
    assert.equal(isNonEmptyString(null), false);
    assert.equal(isNonEmptyString(undefined), false);
  });

  test('rejects a whitespace-only string', () => {
    assert.equal(isNonEmptyString('   '), false);
  });

  test('accepts a string with real content', () => {
    assert.equal(isNonEmptyString('Karahi'), true);
  });
});

describe('isOneOf', () => {
  test('true when the value is in the list', () => {
    assert.equal(isOneOf('woman', ['woman', 'man', 'non_binary']), true);
  });

  test('false when the value is not in the list', () => {
    assert.equal(isOneOf('cat', ['woman', 'man', 'non_binary']), false);
  });
});

describe('passwordStrengthError', () => {
  test('rejects a non-string password', () => {
    assert.equal(passwordStrengthError(undefined), 'Password must be at least 8 characters');
  });

  test('rejects a password shorter than 8 characters', () => {
    assert.equal(passwordStrengthError('Ab1!'), 'Password must be at least 8 characters');
  });

  test('rejects a password with no digit', () => {
    assert.equal(passwordStrengthError('abcdefgh!'), 'Password must include at least one number');
  });

  test('rejects a password with no special character', () => {
    assert.equal(passwordStrengthError('abcdefgh1'), 'Password must include at least one special character');
  });

  test('accepts a password meeting every rule', () => {
    assert.equal(passwordStrengthError('abcdefgh1!'), null);
  });
});
