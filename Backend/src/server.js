import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { authRouter } from './routes/auth.js';
import { restaurantsRouter } from './routes/restaurants.js';
import { tablesRouter, seatRequestsRouter } from './routes/tables.js';
import { profileRouter, interestsRouter, peopleRouter, matchesRouter, privacySettingsRouter } from './routes/profile.js';
import { conversationsRouter, notificationsRouter } from './routes/messaging.js';
import { emergencyContactsRouter, blocksRouter, reportsRouter } from './routes/safety.js';
import { verificationRouter } from './routes/verification.js';
import { paymentMethodsRouter } from './routes/payments.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and set one.');
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
app.use(express.json());

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

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Only binds a port when run directly (`node src/server.js`); tests import
// `app` and call `app.listen(0)` themselves so each test file gets its own
// ephemeral port instead of colliding with a dev server already on 3000.
// pathToFileURL (not string concatenation) handles Windows drive letters and
// slash direction correctly, which a naive `file://${argv[1]}` comparison
// does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
}

export { app };
