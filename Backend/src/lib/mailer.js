// Sends transactional email via Resend's HTTP API (https://resend.com).
// No SDK dependency -- it's a single POST, and every other integration in
// this codebase (the payment gateways) already talks to third parties over
// plain fetch rather than pulling in a client library.
//
// isConfigured() mirrors the payment-gateway pattern: a provider whose
// credentials aren't set just gets skipped by the caller (auth.js falls
// back to logging the reset link server-side) instead of the app failing
// to start.

const RESEND_API_URL = 'https://api.resend.com/emails';

function isConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject: 'Reset your What Should We Eat password',
      html: `
        <p>Someone asked to reset the password on this account.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p>This link expires in 60 minutes. If you didn't request this, you can ignore this email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API responded ${res.status}: ${body}`);
  }
}

export const mailer = { isConfigured, sendPasswordResetEmail };
