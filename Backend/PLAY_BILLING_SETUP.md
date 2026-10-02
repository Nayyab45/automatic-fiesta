# Google Play Billing setup (Basic/Standard/Premium + Remove ads subscriptions)

Code is already wired up (`src/lib/tiers.js`, `src/lib/googlePlay.js`,
`src/routes/subscriptions.js`, and the Dinner-ionic pricing page/billing
service). Nothing will actually work until the two steps below are done in
Play Console -- there's no API that can do this for you, it has to be done
by hand while signed in as the account that owns the `weeat.netstech.net`
app listing.

## 1. Create the 3 subscription products

Play Console -> your app -> Monetize -> Products -> Subscriptions -> Create
subscription. Create exactly these 3, each with ONE base plan, auto-renewing,
monthly:

| Product ID              | Base plan price (PKR) |
|--------------------------|------------------------|
| `weeat_basic_monthly`    | 500                    |
| `weeat_standard_monthly` | 1000                   |
| `weeat_premium_monthly`  | 2000                   |

The product IDs must match exactly -- they're hardcoded in
`Backend/src/lib/tiers.js` and `Dinner-ionic/src/app/services/billing.service.ts`.
If you want different IDs, change them in both places.

Then create a 4th subscription for the standalone **Remove ads** add-on. This
one is a single product with TWO base plans (not two products):

| Product ID     | Base plan ID | Billing period | Price (PKR) |
|----------------|--------------|----------------|-------------|
| `removal_ads`  | `monthly`    | monthly        | 500         |
| `removal_ads`  | `yearly`     | yearly         | 5500        |

Product ID and base plan IDs must match exactly (`AD_REMOVAL` in
`Backend/src/lib/tiers.js`). It is billed separately from the three tiers, so
someone can hold both; the app hides ads if either grants it. It is verified
through Google's `subscriptionsv2` API, which the same service account covers.

A subscription product can't go live until the app has at least one APK/AAB
uploaded to a track (even internal testing) with billing permission -- if
product creation is blocked, upload the current release build to Internal
testing first, then come back to this step.

## 2. Create a service account for server-side purchase verification

The backend (`src/lib/googlePlay.js`) verifies every purchase against
Google's own records before granting a tier -- it needs its own credential
for that, separate from your personal Play Console login.

1. Play Console -> Setup -> API access -> "Choose a Google Cloud project"
   (or create one) -> "Create new service account" (this deep-links to
   Google Cloud Console).
2. In Cloud Console, finish creating the service account, then create a
   JSON key for it (Keys -> Add key -> JSON) and download it.
3. Back in Play Console -> API access, find the new service account in the
   list and grant it access: "Financial data" (view) + "Manage orders and
   subscriptions" is enough -- no need for Admin.
4. Copy the downloaded JSON file onto the backend server (do NOT commit it
   to git -- it's a credential) and set one of these in `.env`:
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH=/absolute/path/to/the/file.json`
   - or `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=<the file's contents as one line>`
     if the host only lets you set environment variables (no filesystem
     access for secrets).

It can take a few minutes to a few hours for Google to propagate the new
service account's permissions -- if `/api/subscriptions/verify` 502s
immediately after setup, wait and retry before assuming something's wrong.

## 3. Testing a real purchase

Google Play won't process a real charge against your own Play Store account
without special setup:

- Play Console -> Setup -> License testing: add the Google account(s) you'll
  test with as license testers. Their purchases go through the full flow but
  are auto-refunded/not actually charged.
- The app must be installed from a Play Store track (internal testing is
  fine) using that same Google account -- a sideloaded APK/debug build can
  still open the purchase sheet, but a purchase against a product that isn't
  live on that install's track will fail.

## What's NOT set up (known v1 limitation)

Subscription state is only refreshed when the app calls `/verify` (right
after a purchase, and again whenever `BillingService.init()` runs on app
start). A cancellation, refund, or failed renewal that happens while the app
isn't open won't be reflected until the user next opens the app. Production-
grade apps handle this with Google's Real-time Developer Notifications (a
Pub/Sub topic Play Console can push subscription state changes to) -- add
that later if stale entitlement windows become a real problem; it needs its
own Pub/Sub topic + a public HTTPS endpoint on this backend to receive
pushes, both out of scope here.
