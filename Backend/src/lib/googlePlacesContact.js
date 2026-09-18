// A restaurant's real phone number + website from Google Places, the same
// source and Find Place -> Place Details flow already used for photos (see
// getGooglePlacePhoto in restaurantPhotos.js), just asking for different
// fields. Opt-in on GOOGLE_PLACES_API_KEY being set, same as photos -- needs
// a billing-enabled Google Cloud project.
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const GOOGLE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

/**
 * { phone, website } for this exact restaurant from Google Places, or null if
 * no API key is configured, no matching place is found, or the match has
 * neither field set. Google Places doesn't expose a business email address
 * at all -- see emailScraper.js for how that's filled in instead, from
 * whatever `website` comes back here. `fetchImpl` is injectable so tests can
 * stand in for the network calls.
 */
export async function getGooglePlaceContact(restaurant, { fetchImpl = fetch } = {}) {
  if (!GOOGLE_PLACES_API_KEY) return null;

  try {
    const query = `${restaurant.name}, ${restaurant.address || restaurant.city}`;
    const findUrl = `${GOOGLE_FIND_PLACE_URL}?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${GOOGLE_PLACES_API_KEY}`;
    const findResponse = await fetchImpl(findUrl);
    if (!findResponse.ok) return null;
    const findData = await findResponse.json();
    const placeId = findData.candidates?.[0]?.place_id;
    if (!placeId) return null;

    const detailsUrl = `${GOOGLE_DETAILS_URL}?place_id=${placeId}&fields=formatted_phone_number,international_phone_number,website&key=${GOOGLE_PLACES_API_KEY}`;
    const detailsResponse = await fetchImpl(detailsUrl);
    if (!detailsResponse.ok) return null;
    const detailsData = await detailsResponse.json();
    const result = detailsData.result;
    if (!result) return null;

    // International format (+92 3xx...) is preferred -- it's what a Twilio
    // SMS `To` needs (see sms.js), while the local formatted_phone_number
    // alone wouldn't be dialable from outside its own country code.
    const phone = result.international_phone_number || result.formatted_phone_number || null;
    if (!phone && !result.website) return null;
    return { phone, website: result.website || null };
  } catch (err) {
    // A network hiccup or no match just means this restaurant keeps
    // whatever contact info it already had (OSM tags, or none).
    console.error(`[googlePlacesContact] lookup failed for "${restaurant?.name}":`, err.message);
    return null;
  }
}
