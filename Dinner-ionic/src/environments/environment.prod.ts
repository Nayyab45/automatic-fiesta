export const environment = {
  production: true,
  apiUrl: 'https://weeat.netstech.net/api',
  // See environment.ts's comment -- same Firebase project's Web OAuth
  // client ID, so this doesn't need a separate value.
  googleWebClientId: '717968251470-ehde551ho258btf9a76v5iqiu4suie7s.apps.googleusercontent.com',
  // The app's real AdMob banner unit ("What Should We Eat?" app, banner
  // unit). This is the ad UNIT id (one slash), NOT the App ID that goes in
  // AndroidManifest.xml -- that lives in android/app/admob.properties
  // (see admob.properties.example). isTesting must stay false here, and
  // environment.ts (dev) must keep Google's test unit id with isTesting:
  // true: never ship isTesting: true with this real id, never run a debug
  // build against it, and never click your own live ads -- all violate
  // AdMob policy and risk the account.
  adMob: {
    bannerAdUnitId: 'ca-app-pub-8616301549412261/6043247244',
    // Real interstitial unit for the same app -- same rules as the banner id.
    interstitialAdUnitId: 'ca-app-pub-8616301549412261/5947792752',
    isTesting: false,
  },
};
