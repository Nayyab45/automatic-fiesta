export async function up(pool) {
  // Caches a city's approximate center (from the same free Nominatim lookup
  // osmPlaces.js already uses for restaurant imports) so "Discover People"
  // can filter by distance without ever needing to store an individual
  // user's live location -- see src/lib/cityGeocode.js. One row per city,
  // looked up once and reused forever, same reasoning as restaurant_import_log.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS city_geocodes (
      city VARCHAR(255) NOT NULL PRIMARY KEY,
      latitude DECIMAL(10, 7) NOT NULL,
      longitude DECIMAL(10, 7) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
