import { db } from '../db.js';

// Shared by profile.js's people-matching (matchesRouter) and restaurants.js's
// recommendation scoring, so "what does this person like" is computed the
// same way in both places instead of drifting apart.
export async function tastePrefsFor(userId) {
  const foodPrefs = await db.prepare('SELECT favorite_foods FROM food_preferences WHERE user_id = ?').get(userId);
  const dietaryPrefs = await db.prepare('SELECT needs, spice_tolerance FROM dietary_preferences WHERE user_id = ?').get(userId);
  return {
    favoriteFoods: foodPrefs?.favorite_foods ? foodPrefs.favorite_foods.split(',').filter(Boolean) : [],
    dietaryNeeds: dietaryPrefs?.needs ? dietaryPrefs.needs.split(',').filter((need) => need && need !== 'No Preference') : [],
    spiceTolerance: dietaryPrefs?.spice_tolerance ?? null,
  };
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points, in kilometers. */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
