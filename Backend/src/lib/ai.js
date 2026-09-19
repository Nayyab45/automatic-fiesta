import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini's free tier (aistudio.google.com/apikey, no billing needed) covers
// this comfortably -- both callers below are small, frequent, latency-
// sensitive calls (one per match card, one per group suggestion), not the
// kind of deep reasoning task that needs a bigger/paid model anyway.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';

let client = null;
function getModel() {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client.getGenerativeModel({ model: MODEL });
}

export function isConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

// Every caller treats a null return as "fall back to the existing
// deterministic heuristic" -- an unset key, a network error, or an
// unparseable response all fail the same safe way, so this can never break
// a match list or a table's restaurant choice, only make it less clever.
async function complete(prompt) {
  if (!isConfigured()) return null;
  try {
    const result = await getModel().generateContent(prompt);
    const text = result.response.text();
    return text ? text.trim() : null;
  } catch (err) {
    console.error('[ai] request failed, falling back to heuristic:', err.message);
    return null;
  }
}

// One short sentence explaining why the caller and a candidate might enjoy
// dining together, grounded only in facts the weighted-scoring match in
// profile.js's matchesRouter already computed -- the model writes the
// sentence, it never re-derives or invents the match itself.
export async function explainMatch({
  candidateName,
  sharedFavoriteFoods,
  sharedDietaryNeeds,
  sameSpiceTolerance,
  spiceTolerance,
  sharedInterests,
  sameCity,
  city,
}) {
  const factLines = [];
  if (sharedFavoriteFoods.length) factLines.push(`Both like: ${sharedFavoriteFoods.join(', ')}`);
  if (sharedDietaryNeeds.length) factLines.push(`Shared dietary needs: ${sharedDietaryNeeds.join(', ')}`);
  if (sameSpiceTolerance) factLines.push(`Same spice tolerance: ${spiceTolerance}`);
  if (sharedInterests.length) factLines.push(`Shared interests: ${sharedInterests.join(', ')}`);
  if (sameCity) factLines.push(`Both based in ${city}`);
  if (factLines.length === 0) return null;

  const prompt = `Write ONE short, warm sentence (max 16 words, no preamble, no quotation marks) for a dining-companion app, explaining why the user might enjoy a meal with ${candidateName}. Base it ONLY on these facts, don't invent anything else:\n${factLines.join('\n')}\n\nSentence:`;
  return complete(prompt);
}

// Picks the best restaurant for a whole group from a fixed shortlist the
// caller already scored heuristically (see restaurants.js's
// /group-recommendation) -- the model can only choose an id it was given,
// so a bad or hallucinated response can never point the group at a
// restaurant that doesn't exist or wasn't actually vetted as a candidate.
export async function pickRestaurantForGroup({ candidates, memberTastes }) {
  const candidateLines = candidates
    .map((c) => `id=${c.id} | ${c.name} | cuisines: ${c.cuisineTags || 'unknown'} | price tier: ${c.priceTier ?? '?'}/4 | rating: ${c.rating ?? '?'}`)
    .join('\n');
  const memberLines = memberTastes
    .map(
      (t, i) =>
        `Person ${i + 1}: favorite foods: ${t.favoriteFoods.join(', ') || 'none set'}; dietary needs: ${t.dietaryNeeds.join(', ') || 'none'}`,
    )
    .join('\n');

  const prompt = `Pick ONE restaurant for a group dinner from this shortlist so every person in the group ends up happy:\n${candidateLines}\n\nGroup members:\n${memberLines}\n\nReply with EXACTLY two lines and nothing else:\nID: <the chosen id, must be one of the ids above>\nREASON: <one short sentence, max 20 words, explaining the pick for this specific group>`;

  const text = await complete(prompt);
  if (!text) return null;

  const idMatch = text.match(/ID:\s*(\d+)/i);
  const reasonMatch = text.match(/REASON:\s*(.+)/i);
  const id = idMatch ? Number(idMatch[1]) : null;
  if (!id || !candidates.some((c) => c.id === id)) return null;
  return { restaurantId: id, reason: reasonMatch ? reasonMatch[1].trim() : null };
}
