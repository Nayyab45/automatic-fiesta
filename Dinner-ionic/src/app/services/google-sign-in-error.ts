// Turns whatever Google Sign-In threw into the message to show, or null when
// the user simply backed out (nothing to say). Shared by login and signup.
//
// "[16] Account reauth failed" is raised by Google itself right after the
// account is picked. In practice (confirmed from the device log, which shows
// UNREGISTERED_ON_API_CONSOLE) it means Google doesn't recognise this build's
// signing certificate for the app -- e.g. an APK installed directly, signed
// with the upload key rather than the Play Store's signing key -- not that
// anything is wrong with the user's account. The plugin reports it with the
// same USER_CANCELLED code as a real dismissal, so it was previously swallowed
// silently and the button just appeared to do nothing -- match it first.
export function googleSignInErrorMessage(err: unknown, action: 'sign in' | 'sign up'): string | null {
  const e = err as { code?: string; message?: string; error?: { message?: string } } | null;
  const text = `${e?.message ?? ''} ${e?.error?.message ?? ''}`;

  if (/reauth/i.test(text)) {
    return (
      "Google sign-in isn't available for this version of the app. If you installed it outside the Play Store, " +
      'install it from the Play Store, or sign in with your email and password instead.'
    );
  }
  // A user backing out of the account picker isn't an error worth showing --
  // same as tapping outside a dialog to dismiss it.
  if (e?.code === 'USER_CANCELLED') return null;
  return e?.error?.message ?? `Unable to ${action} with Google. Please try again.`;
}
