import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';

// Public marketing homepage + privacy policy, served at the domain root
// (weeat.netstech.net/, /privacy-policy) so the Google OAuth consent screen
// has a real, unauthenticated homepage and privacy policy to point at --
// nginx here proxies "/" straight to this Express app, and there was no
// route for it at all before, so every hit came back "Cannot GET /".
export const siteRouter = Router();

// Mirrors Dinner-ionic/src/app/shared/policy-content.ts DEFAULT_PRIVACY_POLICY.
// Kept as a plain copy (not imported) because the frontend is a separate
// Angular/TS project with no build link to this one; update both together.
const DEFAULT_PRIVACY_POLICY = {
  intro:
    "Last updated: September 2026\nThis describes what What Should We Eat? actually collects, why, and how you can control or remove it.",
  sections: [
    {
      heading: 'Information We Collect',
      body: "- **Account & profile:** name, email, password (stored hashed, never in plain text), age, city/province, a short bio, a profile photo you upload, and your food/cuisine preferences.\n- **Identity verification (optional):** if you choose to verify your identity, we store the ID photo and selfie you submit until your verification is reviewed.\n- **Dining activity:** tables you host or join, seat requests, reviews you write, and restaurants you save.\n- **Messages:** direct messages and table group chat messages you send through the app.\n- **Safety & trust:** emergency contacts you add, and any blocks or reports you file (or that are filed against you).",
    },
    {
      heading: 'Location',
      body: "What Should We Eat? does **not** access your device's GPS or precise location, and the app does not request location permission from your device. Restaurant discovery is based entirely on a city you choose yourself from a list, which you can change at any time.",
    },
    {
      heading: 'How We Use Your Data',
      body: '- To operate the core features you use directly: discovering restaurants and people, hosting/joining dining tables, messaging, and reviews.\n- To verify identity when you choose to, for trust and safety.\n- To act on safety reports, blocks, and emergency contact information if you use those features.\n- To secure your account (password hashing, session tokens, optional two-factor authentication).\nWe do not sell your personal data to third parties or advertisers.',
    },
    {
      heading: 'Who Can See Your Data',
      body: '- Other users see the profile information you choose to make visible, and any messages/reviews you post are visible to their intended recipients or the public dining table.\n- We do not share your data with advertisers or data brokers.',
    },
    {
      heading: 'Your Controls',
      body: '- Toggle your profile\'s visibility to other users from Privacy Settings.\n- Block or report another user at any time.\n- Enable or disable two-factor authentication from Manage Account.\n- Delete your account entirely from Manage Account, which removes your profile, preferences, and associated data.',
    },
    {
      heading: 'Security',
      body: 'Passwords are hashed, never stored in plain text. Sessions use short-lived access tokens with a separate, revocable refresh token. No electronic storage or transmission can be guaranteed 100% secure, but we design for the practices above rather than treating them as optional.',
    },
    {
      heading: 'Children',
      body: 'What Should We Eat? is intended for users aged 18 and over, given its social dining-matching features.',
    },
    {
      heading: 'Contact Us',
      body: 'Questions about this policy or your data:\nnayyabashfaq05@gmail.com',
    },
  ],
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Same plain-text format the app's PolicyBodyComponent renders: one
// paragraph per line, "- " for a bullet, **text** for bold.
function renderBody(body) {
  const blocks = [];
  let list = null;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const isBullet = line.startsWith('- ');
    const text = (isBullet ? line.slice(2) : line)
      .split('**')
      .map((segment, i) => (i % 2 === 1 ? `<strong>${escapeHtml(segment)}</strong>` : escapeHtml(segment)))
      .join('');
    if (isBullet) {
      if (!list) {
        list = [];
        blocks.push({ kind: 'ul', items: list });
      }
      list.push(text);
    } else {
      list = null;
      blocks.push({ kind: 'p', text });
    }
  }
  return blocks
    .map((block) =>
      block.kind === 'ul'
        ? `<ul>${block.items.map((item) => `<li>${item}</li>`).join('')}</ul>`
        : `<p>${block.text}</p>`,
    )
    .join('\n');
}

const PAGE_STYLE = `
  :root { color-scheme: light; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #2b2320; background: #fffaf3; line-height: 1.6; }
  header { background: #7a2e1d; color: #fff; padding: 28px 20px; }
  header .brand { max-width: 760px; margin: 0 auto; display: flex; align-items: center; gap: 12px; }
  header h1 { margin: 0; font-size: 1.6rem; }
  header p { margin: 4px 0 0; opacity: 0.85; font-size: 0.95rem; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
  h2 { color: #7a2e1d; margin-top: 2.2em; }
  a { color: #b3552f; }
  ul { padding-left: 1.3em; }
  .lede { font-size: 1.1rem; }
  footer { text-align: center; padding: 24px 20px 48px; font-size: 0.85rem; color: #756a63; }
  footer a { color: #7a2e1d; margin: 0 8px; }
`;

siteRouter.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>What Should We Eat</title>
<meta name="description" content="What Should We Eat is a dining-social app: discover restaurants, host or join dining tables, and match with people who share your food preferences.">
<style>${PAGE_STYLE}</style>
</head>
<body>
<header>
<div class="brand">
<div>
<h1>What Should We Eat</h1>
<p>Good food. Great company.</p>
</div>
</div>
</header>
<main>
<p class="lede">What Should We Eat is a dining-social app that helps you decide where to eat and who to eat with. Instead of eating alone or scrolling reviews, you browse restaurants, host or join a table, and match with other diners nearby who share your taste in food.</p>
<h2>What you can do</h2>
<ul>
<li><strong>Discover restaurants</strong> in your city, browse menus and dishes, and save your favorites.</li>
<li><strong>Host or join a dining table</strong> with other members for a specific restaurant and time.</li>
<li><strong>Match with people</strong> based on shared food preferences, dietary needs, and interests.</li>
<li><strong>Message and coordinate</strong> with your table before you meet, and review the meal after.</li>
</ul>
<h2>Sign in</h2>
<p>What Should We Eat supports signing in with a regular account or with Google Sign-In. We only request your name, email address, and profile photo from Google to create and identify your account -- see the Privacy Policy below for full detail on what we collect and why.</p>
<h2>Privacy</h2>
<p>Read our <a href="/privacy-policy">Privacy Policy</a> for what we collect, how it's used, and how to control or delete it.</p>
</main>
<footer>
<a href="/privacy-policy">Privacy Policy</a>
<span>&middot;</span>
<a href="mailto:nayyabashfaq05@gmail.com">Contact</a>
</footer>
</body>
</html>`);
});

// Public: readable without signing in.
siteRouter.get(
  '/privacy-policy',
  asyncHandler(async (_req, res) => {
    const content = DEFAULT_PRIVACY_POLICY;

    const introHtml = content.intro
      .split('\n')
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('\n');
    const sectionsHtml = content.sections
      .map((section, i) => `<h2>${i + 1}. ${escapeHtml(section.heading)}</h2>\n${renderBody(section.body)}`)
      .join('\n');

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy - What Should We Eat</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<header>
<div class="brand">
<div>
<h1>What Should We Eat</h1>
<p>Privacy Policy</p>
</div>
</div>
</header>
<main>
${introHtml}
${sectionsHtml}
</main>
<footer>
<a href="/">Home</a>
</footer>
</body>
</html>`);
  }),
);
