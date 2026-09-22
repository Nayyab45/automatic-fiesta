// Sends SMS via Twilio's REST API (https://www.twilio.com). No SDK
// dependency, matching mailer.js's approach for Resend -- a single POST
// with Basic Auth is all this needs.
//
// isConfigured() means a provider whose credentials aren't set just gets
// skipped by the caller instead of the app failing to start.

function isConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

async function sendSms({ to, body }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER, Body: body }),
  });

  if (!res.ok) {
    const responseBody = await res.text().catch(() => '');
    throw new Error(`Twilio API responded ${res.status}: ${responseBody}`);
  }
}

export const sms = { isConfigured, sendSms };
