// Combines the two pieces needed to reach a restaurant for real: a verified
// phone number from Google Places, and an email scraped from that same
// restaurant's own website (Google Places has no email field of its own).
// Used by both the OSM city-import pipeline (osmPlaces.js) and the
// backfill-restaurant-contact-from-google.mjs script.
import { getGooglePlaceContact } from './googlePlacesContact.js';
import { scrapeEmailFromWebsite } from './emailScraper.js';

/**
 * { phone, email, website }, each null if not found. `restaurant` needs
 * `name` and either `address` or `city` -- same shape getGooglePlacePhoto
 * already expects.
 */
export async function enrichRestaurantContact(restaurant) {
  const googleContact = await getGooglePlaceContact(restaurant);
  if (!googleContact) return { phone: null, email: null, website: null };

  const email = await scrapeEmailFromWebsite(googleContact.website);
  return { phone: googleContact.phone, email, website: googleContact.website };
}
