// A city's approximate center, for filtering "Discover People" by distance
// without ever storing an individual user's live location -- only their
// self-reported city (see user_profiles.city). Reuses the same free/keyless
// Nominatim lookup osmPlaces.js already uses for restaurant imports, and
// caches the result forever (one row per city, see migration
// 0018_city_geocodes.js), same reasoning as restaurant_import_log: a shared
// public service, not something to hit on every request.
import { db } from '../db.js';
import { lookupCityBoundingBox } from './osmPlaces.js';

/** { latitude, longitude } for a city's approximate center, or null if the
 * city can't be resolved (unknown/misspelled name, Nominatim unreachable). */
export async function cityCoordinates(city) {
  const cached = await db.prepare('SELECT latitude, longitude FROM city_geocodes WHERE city = ?').get(city);
  if (cached) return { latitude: Number(cached.latitude), longitude: Number(cached.longitude) };

  const bbox = await lookupCityBoundingBox(city);
  if (!bbox) return null;

  const latitude = (bbox.north + bbox.south) / 2;
  const longitude = (bbox.east + bbox.west) / 2;
  await db
    .prepare('INSERT IGNORE INTO city_geocodes (city, latitude, longitude) VALUES (?, ?, ?)')
    .run(city, latitude, longitude);
  return { latitude, longitude };
}
