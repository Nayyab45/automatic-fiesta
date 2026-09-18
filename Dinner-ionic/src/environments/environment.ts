// LAN IP (not localhost) so a debug build on a physical phone can reach
// this machine's backend over Wi-Fi -- "localhost" on the phone means the
// phone itself, not this PC. Browser dev (`ng serve`) still works fine
// against this same address since it's reachable from this machine too.
// If this machine's IP changes (different Wi-Fi network, DHCP renewal),
// update this to match (Windows: `ipconfig`, look for the Wi-Fi adapter's
// IPv4 address).
export const environment = {
  production: false,
  apiUrl: 'http://192.168.8.251:3113/api',
  // The Firebase project's "Web" OAuth client ID (ends in
  // .apps.googleusercontent.com), from Firebase Console -> Authentication ->
  // Sign-in method -> Google, after enabling it there. Required for
  // Google Sign-In on Android too (Credential Manager needs it as
  // webClientId, not the separate Android client) -- see
  // AuthService.signInWithGoogle. Empty until that's set up; the Google
  // button will show a clear error instead of silently failing until then.
  googleWebClientId: '213347467379-1m4n20msv4o6blto7qh3nq3aeluhhj4g.apps.googleusercontent.com',
};
