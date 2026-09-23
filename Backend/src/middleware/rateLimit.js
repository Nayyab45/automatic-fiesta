import rateLimit from 'express-rate-limit';

// Applied per-route (not globally) to the handful of unauthenticated
// endpoints that are actually worth throttling: guessing a password,
// spamming account creation, and spamming password-reset emails/tokens. Keyed
// by IP (the default), which requires server.js to set `trust proxy` so
// req.ip reflects the real client through nginx rather than nginx's own
// address for every request.
const message = { message: 'Too many attempts. Please try again later.' };

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});
