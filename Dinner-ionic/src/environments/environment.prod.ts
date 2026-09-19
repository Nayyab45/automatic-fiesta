export const environment = {
  production: true,
  apiUrl: 'https://weeat.netstech.net/api',
  // See environment.ts's comment -- same Firebase project's Web OAuth
  // client ID, so this doesn't need a separate value.
  googleWebClientId: '213347467379-1m4n20msv4o6blto7qh3nq3aeluhhj4g.apps.googleusercontent.com',
  // Still Google's public TEST banner unit id / isTesting: true, same as
  // environment.ts -- deliberately NOT swapped yet. Before a real Play Store
  // release: create a banner ad unit for this app at admob.google.com, put
  // its real id here (looks like 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
  // NOT the App ID that goes in AndroidManifest.xml -- see
  // android/app/admob.properties.example for that one), and flip isTesting
  // to false in the SAME change. Never ship isTesting: false with this test
  // id, and never ship isTesting: true with a real id -- both violate
  // AdMob policy and risk the account.
  adMob: {
    bannerAdUnitId: 'ca-app-pub-3940256099942544/6300978111',
    isTesting: true,
  },
};
