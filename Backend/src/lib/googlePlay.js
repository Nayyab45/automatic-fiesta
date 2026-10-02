import { GoogleAuth } from 'google-auth-library';

// Verifies a subscription purchase directly against Google's own records
// (the Play Developer API), never trusting the productId/purchaseToken pair
// a client sends at face value -- a purchase token is opaque to the app that
// received it but Google can always say what it's actually worth. Requires
// a service account with "View financial data" + "Manage orders and
// subscriptions" access granted in Play Console -> Setup -> API access, its
// key JSON saved locally, and its path set as GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH
// in .env. See Backend/PLAY_BILLING_SETUP.md for the exact steps.
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

let authClientPromise = null;

function isConfigured() {
  return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH || process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
}

// Cached across calls (a GoogleAuth client internally caches/refreshes its
// own access token) rather than re-reading the key file and re-authing on
// every purchase verification.
function authClient() {
  if (!authClientPromise) {
    const auth = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
      ? new GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON), scopes: [ANDROID_PUBLISHER_SCOPE] })
      : new GoogleAuth({ keyFile: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH, scopes: [ANDROID_PUBLISHER_SCOPE] });
    authClientPromise = auth.getClient();
  }
  return authClientPromise;
}

const PACKAGE_NAME = 'weeat.netstech.net'; // must match android/app/build.gradle's applicationId

function subscriptionUrl(productId, purchaseToken, suffix = '') {
  return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${encodeURIComponent(
    productId,
  )}/tokens/${encodeURIComponent(purchaseToken)}${suffix}`;
}

// Returns Google's purchase record: { expiryTimeMillis, autoRenewing,
// paymentState, acknowledgementState, ... } (see Play Developer API docs for
// SubscriptionPurchase). Throws if not configured, the token is invalid, or
// the request otherwise fails -- callers decide how to surface that.
export async function verifySubscriptionPurchase(productId, purchaseToken) {
  if (!isConfigured()) {
    throw new Error('Google Play billing verification is not configured on this server yet.');
  }
  const client = await authClient();
  const { data } = await client.request({ url: subscriptionUrl(productId, purchaseToken) });
  return data;
}

// Subscriptions with multiple base plans (the Remove ads product) are looked
// up through the v2 API: it needs only the token, and reports which product
// and base plan Google actually sold, so neither is taken from the client.
// Returns { subscriptionState, acknowledgementState, lineItems: [{ productId,
// expiryTime, autoRenewingPlan, offerDetails: { basePlanId } }], ... }.
export async function verifySubscriptionPurchaseV2(purchaseToken) {
  if (!isConfigured()) {
    throw new Error('Google Play billing verification is not configured on this server yet.');
  }
  const client = await authClient();
  const { data } = await client.request({
    url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(
      purchaseToken,
    )}`,
  });
  return data;
}

// A purchase must be acknowledged within 3 days of the charge or Google
// automatically refunds it -- see the acknowledgementState check in
// subscriptions.js's /verify handler that calls this.
export async function acknowledgeSubscriptionPurchase(productId, purchaseToken) {
  const client = await authClient();
  await client.request({ url: subscriptionUrl(productId, purchaseToken, ':acknowledge'), method: 'POST', data: {} });
}

export { isConfigured as isGooglePlayBillingConfigured };
