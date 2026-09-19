import 'dotenv/config'; // touched to force node --watch to reload .env after a DB credential change
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSchema } from './db.js';
import { authRouter } from './routes/auth.js';
import { restaurantsRouter } from './routes/restaurants.js';
import { tablesRouter, seatRequestsRouter } from './routes/tables.js';
import { profileRouter, interestsRouter, peopleRouter, matchesRouter, privacySettingsRouter } from './routes/profile.js';
import { conversationsRouter, notificationsRouter } from './routes/messaging.js';
import { emergencyContactsRouter, blocksRouter, reportsRouter } from './routes/safety.js';
import { verificationRouter } from './routes/verification.js';
import { paymentMethodsRouter } from './routes/payments.js';
import { subscriptionsRouter, subscriptionCallbackRouter } from './routes/subscriptions.js';
import { friendsRouter, followsRouter } from './routes/friends.js';
import { waitlistRouter } from './routes/waitlist.js';
import { contentRouter } from './routes/content.js';
import { supportRouter } from './routes/support.js';
import { siteRouter } from './routes/site.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and set one.');
  process.exit(1);
}

// PAYMENT_MOCK_MODE fakes a successful charge for every payment method,
// with no real processor involved -- useful for testing checkout before a
// merchant account exists, but it must never be reachable in production
// (a real user would "pay" and get premium activated for free).
if (process.env.PAYMENT_MOCK_MODE === 'true' && process.env.NODE_ENV === 'production') {
  console.error('PAYMENT_MOCK_MODE=true is not allowed with NODE_ENV=production -- it fakes successful payments for real users.');
  process.exit(1);
}

const app = express();

// CORS_ORIGIN is unset in local dev (falls back to `cors()`'s wide-open
// default, matching prior behavior) and should be set to the real deployed
// frontend's origin(s) in production. Comma-separated for the case where a
// web build and a Capacitor-wrapped app hit the same backend from different
// origins.
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim());
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
// Raised from Express's 100kb default: profile photos are sent as base64
// data URLs (~33% larger than the original file), and the client-side
// compression in resizeImageToDataUrl() targets a few hundred KB, not 100kb.
app.use(express.json({ limit: '5mb' }));

// Serves the restaurant/dish photos self-hosted from src/assets/images
// (downloaded via scripts/download-restaurant-images.mjs) instead of
// hotlinking Google's prototype CDN. Seed data builds each photoUrl from
// PUBLIC_ASSET_BASE_URL + this path -- see db/seed/restaurants.js.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/images', express.static(path.join(__dirname, 'assets', 'images')));

// Google Search Console's HTML-file domain-verification files (e.g.
// /google<token>.html), needed to prove ownership of weeat.netstech.net for
// the OAuth consent screen. nginx proxies every path here to this app --
// there's no separate static file server in front of it -- so this is
// where such a file has to be served from.
app.use(express.static(path.join(__dirname, 'assets', 'site-verification')));

// Public homepage + privacy policy at the domain root -- nginx proxies "/"
// on weeat.netstech.net straight to this app, and until now nothing handled
// it (every hit was a bare 404), which is what Google's OAuth consent
// screen homepage check was flagging.
app.use('/', siteRouter);

app.use('/api/auth', authRouter);
app.use('/api/restaurants', restaurantsRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/seat-requests', seatRequestsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/interests', interestsRouter);
app.use('/api/people', peopleRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/profile/me/privacy-settings', privacySettingsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/emergency-contacts', emergencyContactsRouter);
app.use('/api/blocks', blocksRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/payment-methods', paymentMethodsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/follows', followsRouter);
app.use('/api/waitlist', waitlistRouter);
app.use('/api/content', contentRouter);
app.use('/api/support', supportRouter);
// Mounted before subscriptionsRouter's own requireAuth applies: the gateway
// calls this directly, not a logged-in user's browser.
app.use('/api/subscriptions/callback', subscriptionCallbackRouter);
app.use('/api/subscriptions', subscriptionsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Catches errors forwarded via next(err) -- notably from asyncHandler when an
// async route handler's promise rejects (e.g. a transient DB error). Without
// this, Express's default error handler still responds, but as HTML instead
// of JSON; this keeps every error response consistent with the rest of the
// API. Must be registered after all routes and take exactly 4 args so
// Express recognizes it as an error handler.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

// Only binds a port unless a test opted out (see test/api.test.js, which
// imports `app` and calls app.listen(0) itself so each test file gets its
// own ephemeral port instead of colliding with a dev server already on
// 3000). Deliberately NOT an "am I the entry module" check (via argv or
// import.meta.main) -- both silently came out false under PM2's fork-mode
// launcher, which loads the script through its own ProcessContainerFork.js
// rather than running it as the literal entry point, so initSchema()/
// app.listen() never ran at all: PM2 showed the process "online" with zero
// errors, just no server ever actually listening. An explicit opt-out flag
// has no such launcher-dependent failure mode.
if (!process.env.SKIP_SERVER_LISTEN) {
  const port = process.env.PORT || 3000;
  initSchema()
    .then(() => {
      app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
    })
    .catch((err) => {
      console.error('Failed to initialize database schema:', err.message);
      process.exit(1);
    });
}

export { app };
