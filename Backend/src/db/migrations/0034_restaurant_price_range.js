export async function up(pool) {
  // A real, editable numeric price (PKR, average per person) the Search &
  // Filter / Discover Restaurants price control can filter a min/max range
  // against -- price_tier (1-4) stays as-is for whatever already reads it,
  // this just adds the continuous field the new range filter needs.
  await pool.query('ALTER TABLE restaurants ADD COLUMN avg_price_pkr INT NULL');

  // Backfill from the existing price_tier using the same PKR bands already
  // shown to users on Discover Restaurants' price chips (Under 500 / 500-1500
  // / 1500-3000 / 3000+) -- each tier's rough midpoint. Restaurants with no
  // price_tier stay NULL (most of the OSM-imported catalog -- see
  // restaurants.js's /group-recommendation comment) rather than guessing.
  await pool.query(`
    UPDATE restaurants SET avg_price_pkr = CASE price_tier
      WHEN 1 THEN 300
      WHEN 2 THEN 1000
      WHEN 3 THEN 2200
      WHEN 4 THEN 3500
      ELSE NULL
    END
    WHERE price_tier IS NOT NULL
  `);
}
