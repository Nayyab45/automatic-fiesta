// LAN IP (not localhost) so a debug build on a physical phone can reach
// this machine's backend over Wi-Fi -- "localhost" on the phone means the
// phone itself, not this PC. Browser dev (`ng serve`) still works fine
// against this same address since it's reachable from this machine too.
// If this machine's IP changes (different Wi-Fi network, DHCP renewal),
// update this to match (Windows: `ipconfig`, look for the Wi-Fi adapter's
// IPv4 address).
export const environment = {
  production: false,
  apiUrl: 'http://10.43.209.160:3000/api',
};
