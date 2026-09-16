// Compares the selfie against the ID photo taken during identity
// verification, via Face++'s Compare API (faceplusplus.com). No SDK
// dependency -- a single POST, consistent with this codebase's other
// third-party integrations (see mailer.js, paymentGateways/).
//
// isConfigured() mirrors the mailer.js/paymentGateways pattern: a provider
// whose credentials aren't set just gets skipped by the caller (submit()
// in routes/verification.js falls back to the old manual-review "pending"
// state) instead of the app failing to start or blocking every signup on a
// missing API key.

const COMPARE_URL = 'https://api-us.faceplusplus.com/facepp/v3/compare';

function isConfigured() {
  return !!(process.env.FACEPP_API_KEY && process.env.FACEPP_API_SECRET);
}

// Both id_front_url/selfie_url are stored as full `data:image/...;base64,`
// URLs (see identity-verification-id-upload.page.ts / face-verification.
// page.ts -- they're read client-side via FileReader.readAsDataURL and
// posted straight through, never uploaded to separate file storage), so
// there's no network fetch needed here: just strip the data-URL prefix and
// hand Face++ the base64 payload directly via image_base64_1/2, rather than
// image_url1/2 which would require these to be reachable from Face++'s
// servers -- they usually aren't (a dev machine's LAN IP, in particular).
function toBase64Payload(dataUrl) {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

async function defaultFetchCompare(idPhotoBase64, selfieBase64) {
  const res = await fetch(COMPARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      api_key: process.env.FACEPP_API_KEY,
      api_secret: process.env.FACEPP_API_SECRET,
      image_base64_1: idPhotoBase64,
      image_base64_2: selfieBase64,
    }),
  });
  return res.json();
}

/** Returns { confidence, isMatch } where confidence is 0-100, or null if
 * Face++ couldn't reach a verdict (no face detected in one of the images,
 * or a transient API error) -- the caller treats null the same as "not
 * configured" rather than as a hard rejection, since a real user shouldn't
 * lose their submission to an API hiccup or a bad-lighting selfie with no
 * way to appeal it.
 *
 * `fetchCompare` is injectable so tests can stub the network call out --
 * same pattern as restaurantPhotos.js's `fetchImage`. */
export async function compareFaces(idPhotoDataUrl, selfieDataUrl, { fetchCompare = defaultFetchCompare } = {}) {
  let json;
  try {
    json = await fetchCompare(toBase64Payload(idPhotoDataUrl), toBase64Payload(selfieDataUrl));
  } catch {
    return null;
  }

  if (typeof json?.confidence !== 'number') {
    return null;
  }

  // Face++ returns the minimum confidence for a 1-in-N false-accept rate at
  // three strictness levels; 1e-4 (1-in-10,000) is their documented
  // recommendation for identity-style verification -- strict enough to
  // reject a stranger's selfie, not so strict that ordinary selfie/ID
  // photo lighting differences get flagged.
  const threshold = json.thresholds?.['1e-4'] ?? 75;
  return { confidence: json.confidence, isMatch: json.confidence >= threshold };
}

export const faceMatch = { isConfigured, compareFaces };
