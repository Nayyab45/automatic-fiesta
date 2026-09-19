// Built-in text for the two admin-editable pages. An admin's edit (saved
// via /api/content/:slug) replaces it; "Reset to default" in the editor
// deletes that edit and this text shows again.
//
// Body format: one paragraph per line; a line starting with "- " is a
// bullet; **double asterisks** make text bold. `icon` (guidelines only) is a
// Material Symbols name -- edited content doesn't carry it, so a card falls
// back to the default card at the same position (see iconForSection).

export interface PolicySection {
  heading: string;
  body: string;
  icon?: string;
}

export interface PolicyContent {
  intro: string;
  sections: PolicySection[];
}

export type PolicySlug = 'privacy-policy' | 'community-guidelines';

export const DEFAULT_PRIVACY_POLICY: PolicyContent = {
  intro: "Last updated: September 2026\nThis describes what What Should We Eat? actually collects, why, and how you can control or remove it.",
  sections: [
    {
      heading: "Information We Collect",
      body: "- **Account & profile:** name, email, password (stored hashed, never in plain text), age, city/province, a short bio, a profile photo you upload, and your food/cuisine preferences.\n- **Identity verification (optional):** if you choose to verify your identity, we store the ID photo and selfie you submit until your verification is reviewed.\n- **Payment methods (optional):** only the payment type and last 4 digits of a card/account, or a wallet phone number for EasyPaisa/JazzCash. We never store full card numbers, bank account numbers, or CVV codes.\n- **Dining activity:** tables you host or join, seat requests, reviews you write, and restaurants you save.\n- **Messages:** direct messages and table group chat messages you send through the app.\n- **Safety & trust:** emergency contacts you add, and any blocks or reports you file (or that are filed against you)."
    },
    {
      heading: "Location",
      body: "What Should We Eat? does **not** access your device's GPS or precise location, and the app does not request location permission from your device. Restaurant discovery is based entirely on a city you choose yourself from a list, which you can change at any time."
    },
    {
      heading: "How We Use Your Data",
      body: "- To operate the core features you use directly: discovering restaurants and people, hosting/joining dining tables, messaging, and reviews.\n- To verify identity and payment methods when you choose to add them, for trust and safety and to process payments through our payment providers.\n- To act on safety reports, blocks, and emergency contact information if you use those features.\n- To secure your account (password hashing, session tokens, optional two-factor authentication).\nWe do not sell your personal data to third parties or advertisers."
    },
    {
      heading: "Who Can See Your Data",
      body: "- Other users see the profile information you choose to make visible, and any messages/reviews you post are visible to their intended recipients or the public dining table.\n- Payment providers (e.g. JazzCash, EasyPaisa, or a card/bank gateway) receive only the information needed to process a payment when you make one.\n- We do not share your data with advertisers or data brokers."
    },
    {
      heading: "Your Controls",
      body: "- Toggle your profile's visibility to other users from Privacy Settings.\n- Block or report another user at any time.\n- Enable or disable two-factor authentication from Manage Account.\n- Delete your account entirely from Manage Account, which removes your profile, preferences, and associated data."
    },
    {
      heading: "Security",
      body: "Passwords are hashed, never stored in plain text. Sessions use short-lived access tokens with a separate, revocable refresh token. No electronic storage or transmission can be guaranteed 100% secure, but we design for the practices above rather than treating them as optional."
    },
    {
      heading: "Children",
      body: "What Should We Eat? is intended for users aged 18 and over, given its social dining-matching features."
    },
    {
      heading: "Contact Us",
      body: "Questions about this policy or your data:\nnayyabashfaq05@gmail.com"
    }
  ]
};

export const DEFAULT_COMMUNITY_GUIDELINES: PolicyContent = {
  intro: "Our community is built on trust.\nPlease read before joining a meal.",
  sections: [
    {
      heading: "Be Yourself",
      body: "Use real photos and accurate profile info.",
      icon: 'person'
    },
    {
      heading: "Respect Everyone",
      body: "No discrimination, harassment, or hate speech.",
      icon: 'favorite'
    },
    {
      heading: "Meet Safely",
      body: "Public restaurants only, use check-in/check-out.",
      icon: 'security'
    },
    {
      heading: "No Solicitation",
      body: "No sales, scams, or dating-app behavior.",
      icon: 'block'
    },
    {
      heading: "Show Up",
      body: "Respect reservations, cancel properly if you can't attend.",
      icon: 'event_available'
    },
    {
      heading: "Report Concerns",
      body: "Use our tools to report or block users who break rules.",
      icon: 'flag'
    },
    {
      heading: "Zero Tolerance",
      body: "Harassment, threats, or scams lead to immediate account suspension.",
      icon: 'warning'
    }
  ]
};

export const DEFAULT_POLICIES: Record<PolicySlug, PolicyContent> = {
  'privacy-policy': DEFAULT_PRIVACY_POLICY,
  'community-guidelines': DEFAULT_COMMUNITY_GUIDELINES,
};

export const POLICY_TITLES: Record<PolicySlug, string> = {
  'privacy-policy': 'Privacy Policy',
  'community-guidelines': 'Community Guidelines',
};

export function isPolicySlug(value: string | null): value is PolicySlug {
  return value === 'privacy-policy' || value === 'community-guidelines';
}

const FALLBACK_ICON = { icon: 'check_circle' };

export function iconForSection(section: PolicySection, index: number): string {
  if (/zero tolerance/i.test(section.heading)) return DEFAULT_COMMUNITY_GUIDELINES.sections[6].icon ?? FALLBACK_ICON.icon;
  return section.icon ?? DEFAULT_COMMUNITY_GUIDELINES.sections[index]?.icon ?? FALLBACK_ICON.icon;
}

export interface TextSegment {
  text: string;
  bold: boolean;
}

export type PolicyBlock = { kind: 'p'; segments: TextSegment[] } | { kind: 'ul'; items: TextSegment[][] };

function segmentsOf(line: string): TextSegment[] {
  return line
    .split('**')
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((segment) => segment.text !== '');
}

// Turns the plain-text body format above into blocks the template renders
// with normal Angular bindings -- never innerHTML, so admin-entered text can't inject markup.
export function parsePolicyBody(body: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('- ')) {
      const item = segmentsOf(line.slice(2));
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ul') last.items.push(item);
      else blocks.push({ kind: 'ul', items: [item] });
    } else {
      blocks.push({ kind: 'p', segments: segmentsOf(line) });
    }
  }
  return blocks;
}
