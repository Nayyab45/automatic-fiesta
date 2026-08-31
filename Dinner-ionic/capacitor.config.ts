import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whatshouldweeat.app',
  appName: 'What Should We Eat?',
  webDir: 'www/browser',
  // Capacitor's default (https://localhost) makes the WebView treat the
  // app's own UI as a secure origin -- which then makes Chromium block any
  // fetch() to a plain http:// backend as "mixed content", independently of
  // (and in addition to) the debug manifest's usesCleartextTraffic flag.
  // http:// avoids that entirely. Doesn't weaken the real API calls: once
  // a deployed backend is HTTPS, calling it from an http:// origin is not a
  // mixed-content case (only insecure-from-secure is blocked). The
  // tradeoff is that a few browser APIs that require a "secure context"
  // (e.g. raw navigator.geolocation) won't work if ever called directly --
  // this app doesn't use any, since Capacitor's own plugins bridge to
  // native code instead.
  server: {
    androidScheme: 'http',
  },
};

export default config;
