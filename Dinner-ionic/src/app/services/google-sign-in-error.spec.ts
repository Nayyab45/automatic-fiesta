import { googleSignInErrorMessage } from './google-sign-in-error';

describe('googleSignInErrorMessage', () => {
  it('returns null when the user just cancelled the picker', () => {
    expect(googleSignInErrorMessage({ code: 'USER_CANCELLED' }, 'sign in')).toBeNull();
  });

  it('explains a Google account reauth failure instead of hiding it, even when reported as a cancellation', () => {
    const msg = googleSignInErrorMessage({ code: 'USER_CANCELLED', message: '[16] Account reauth failed.' }, 'sign in');
    expect(msg).toContain('verify this account');
    expect(msg).toContain('Settings');
  });

  it('prefers a server-provided message', () => {
    expect(googleSignInErrorMessage({ error: { message: 'Invalid Google credential.' } }, 'sign in')).toBe(
      'Invalid Google credential.',
    );
  });

  it('falls back to a generic message naming the action', () => {
    expect(googleSignInErrorMessage(new Error('boom'), 'sign up')).toBe('Unable to sign up with Google. Please try again.');
    expect(googleSignInErrorMessage(undefined, 'sign in')).toBe('Unable to sign in with Google. Please try again.');
  });
});
