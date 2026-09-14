// Push notifications via Firebase Cloud Messaging. Fully optional: with no
// firebase-service-account.json present, `messaging` stays null and every
// export here quietly no-ops -- in-app notifications (the `notifications`
// table + GET /api/notifications) work the same either way, they just don't
// also arrive as a device push.
import { existsSync, readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { db } from '../db.js';

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'firebase-service-account.json';

let messaging = null;
if (existsSync(SERVICE_ACCOUNT_PATH)) {
  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  const app = initializeApp({ credential: cert(serviceAccount) });
  messaging = getMessaging(app);
} else {
  console.warn(
    `[push] ${SERVICE_ACCOUNT_PATH} not found -- push notifications are disabled (in-app notifications still work).`,
  );
}

export async function registerDeviceToken(userId, token) {
  await db
    .prepare(
      `INSERT INTO device_tokens (user_id, token) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), updated_at = NOW()`,
    )
    .run(userId, token);
}

export async function unregisterDeviceToken(token) {
  await db.prepare('DELETE FROM device_tokens WHERE token = ?').run(token);
}

// FCM error codes that mean "this token will never work again" (app
// uninstalled, token superseded by a new one) -- distinct from a transient
// failure, which should just be retried next time rather than deleting a
// token that might still be good.
const DEAD_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * Sends a push to every device the user is registered on. Best-effort and
 * never throws -- a push failure (Firebase not configured, a dead token, a
 * network hiccup) must never break the request that triggered the
 * notification (a seat request, a friend request, ...); the in-app
 * notification row is already saved regardless.
 */
export async function sendPushToUser(userId, { title, body, data = {} } = {}) {
  if (!messaging) return;

  try {
    const tokens = await db.prepare('SELECT token FROM device_tokens WHERE user_id = ?').all(userId);
    if (!tokens.length) return;

    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((row) => row.token),
      notification: { title, body },
      // FCM data payloads are string-only.
      data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
      android: {
        priority: 'high',
        // Must match the channel id the app creates on launch (see
        // push-notification.service.ts) -- Android silently drops the
        // sound/heads-up behavior otherwise.
        notification: { channelId: 'default', sound: 'default' },
      },
    });

    const deadTokens = response.responses
      .map((result, index) => (!result.success && DEAD_TOKEN_ERROR_CODES.has(result.error?.code) ? tokens[index].token : null))
      .filter(Boolean);
    if (deadTokens.length) {
      await Promise.all(deadTokens.map((token) => unregisterDeviceToken(token)));
    }
  } catch (err) {
    console.error('[push] sendPushToUser failed:', err.message);
  }
}
