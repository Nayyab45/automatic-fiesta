// Best-effort scrape of a contact email off a restaurant's own website.
// Google Places (see googlePlacesContact.js) gives a real, verified phone
// number but has no email field at all -- this is the only automated way to
// get one, by reading it straight off the horse's mouth (the restaurant's
// own site) rather than guessing or fabricating one.
const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = 'WhatShouldWeEat-DevApp/1.0 (contact: nayyabashfaq05@gmail.com)';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|svg|webp|bmp)$/i;

// Cloudflare's "Email Address Obfuscation" (on by default on a lot of small
// business sites, incl. ones hosted behind Cloudflare's free tier) rewrites
// every mailto:/visible email in the HTML into a `data-cfemail="<hex>"`
// attribute plus a `[email protected]` placeholder, decoded client-side by a
// injected script -- so a plain-text regex over the raw HTML never sees the
// real address at all without this decode step. XOR-with-first-byte is
// Cloudflare's own (undocumented but stable, unchanged in years) scheme.
const CF_EMAIL_REGEX = /data-cfemail="([a-f0-9]+)"/g;

function decodeCloudflareEmail(hex) {
  const bytes = hex.match(/../g)?.map((byte) => parseInt(byte, 16)) ?? [];
  const key = bytes[0];
  if (key === undefined) return null;
  return bytes
    .slice(1)
    .map((byte) => String.fromCharCode(byte ^ key))
    .join('');
}

function extractCloudflareEmails(html) {
  const emails = [];
  for (const match of html.matchAll(CF_EMAIL_REGEX)) {
    const decoded = decodeCloudflareEmail(match[1]);
    if (decoded) emails.push(decoded);
  }
  return emails;
}

// Addresses belonging to page-builder/analytics/placeholder infrastructure
// rather than the restaurant itself -- these show up constantly in scraped
// HTML/JS (error trackers, template boilerplate, schema examples) and would
// otherwise get stored as if they were a real way to reach the restaurant.
const JUNK_EMAIL_DOMAINS = [
  'sentry.io',
  'wixpress.com',
  'godaddy.com',
  'example.com',
  'domain.com',
  'schema.org',
  'w3.org',
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'facebook.com',
  'wordpress.org',
  'yourdomain.com',
  'sentry-next.wixpress.com',
];

function isJunkEmail(email) {
  const lower = email.toLowerCase();
  if (IMAGE_EXTENSION_REGEX.test(lower)) return true;
  return JUNK_EMAIL_DOMAINS.some((domain) => lower.endsWith(`@${domain}`) || lower.includes(`.${domain}`));
}

function extractEmails(html) {
  const plainTextEmails = html.match(EMAIL_REGEX) || [];
  const allEmails = [...plainTextEmails, ...extractCloudflareEmails(html)];
  return [...new Set(allEmails)].filter((email) => !isJunkEmail(email));
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The first plausible contact email found on `websiteUrl`, or null if the
 * site is unreachable, times out, or has no findable (non-junk) address.
 * Tries the homepage first, then a `/contact` page if the homepage has none
 * -- most restaurant sites either put an email straight on the homepage
 * footer or tuck it away on a dedicated contact page. `fetchImpl` is
 * injectable so tests can stand in for the network calls.
 */
export async function scrapeEmailFromWebsite(websiteUrl, { fetchImpl = fetchWithTimeout } = {}) {
  if (!websiteUrl) return null;

  try {
    const homeResponse = await fetchImpl(websiteUrl);
    if (homeResponse.ok) {
      const homeEmails = extractEmails(await homeResponse.text());
      if (homeEmails.length) return homeEmails[0];
    }

    const contactUrl = new URL('/contact', websiteUrl).toString();
    const contactResponse = await fetchImpl(contactUrl);
    if (!contactResponse.ok) return null;
    const contactEmails = extractEmails(await contactResponse.text());
    return contactEmails[0] ?? null;
  } catch (err) {
    // Unreachable site, timeout, or a malformed website URL from Google --
    // this restaurant just ends up with a phone number but no email.
    console.error(`[emailScraper] scrape failed for "${websiteUrl}":`, err.message);
    return null;
  }
}
