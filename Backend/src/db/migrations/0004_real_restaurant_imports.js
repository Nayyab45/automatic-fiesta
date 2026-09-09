export async function up(pool) {
  // Real places pulled from OpenStreetMap (see src/lib/osmPlaces.js) have no
  // genuine rating/review count/price tier -- these become nullable instead
  // of getting a fabricated value, matching this app's existing preference
  // for an honest "not available" over invented numbers.
  await pool.query('ALTER TABLE restaurants MODIFY rating DOUBLE NULL');
  await pool.query('ALTER TABLE restaurants MODIFY review_count INT NULL');
  await pool.query('ALTER TABLE restaurants MODIFY price_tier INT NULL');

  await pool.query(`
    ALTER TABLE restaurants
      ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'seed',
      ADD COLUMN external_id VARCHAR(64) NULL UNIQUE
  `);

  // One row per city that has ever been imported from OpenStreetMap, so a
  // city with zero real OSM-tagged restaurants isn't re-queried on every
  // request -- see importCityRestaurants in src/lib/osmPlaces.js.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurant_import_log (
      city VARCHAR(255) NOT NULL PRIMARY KEY,
      imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      place_count INT NOT NULL
    )
  `);
}
