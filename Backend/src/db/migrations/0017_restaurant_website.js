export async function up(pool) {
  // Stores the restaurant's own website (found via Google Places, see
  // src/lib/googlePlacesContact.js) so a contact email can be scraped from
  // it -- Google Places has no email field of its own -- and so
  // re-enrichment later doesn't need a fresh Google API call just to
  // rediscover the same site.
  await pool.query('ALTER TABLE restaurants ADD COLUMN website VARCHAR(500) NULL');
}
