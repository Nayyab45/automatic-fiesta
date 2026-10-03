// Turns whatever Google Sign-In threw into the message to show, or null when
// the user simply backed out (nothing to say). Shared by login and signup.
//
// "[16] Account reauth failed" is raised by Google itself after the account is
// picked, when the Google account on the phone needs to be re-verified (stale
// session, changed password, security check). The plugin reports it with the
// same USER_CANCELLED code as a real dismissal, so it was previously swallowed
// silently and the button just appeared to do nothing -- match it first.
export function googleSignInErrorMessage(err: unknown, action: 'sign in' | 'sign up'): string | null {
  const e = err as { code?: string; message?: string; error?: { message?: string } } | null;
  const text = `${e?.message ?? ''} ${e?.error?.message ?? ''}`;

  if (/reauth/i.test(text)) {
    return (
      "Google couldn't verify this account on your phone. Open Settings > Google (or Passwords & accounts), " +
      're-verify or remove and re-add that Google account, then try again -- or pick a different Google account.'
    );
  }
  // A user backing out of the account picker isn't an error worth showing --
  // same as tapping outside a dialog to dismiss it.
  if (e?.code === 'USER_CANCELLED') return null;
  return e?.error?.message ?? `Unable to ${action} with Google. Please try again.`;
}
