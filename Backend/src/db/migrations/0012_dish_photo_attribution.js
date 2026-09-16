export async function up(pool) {
  // Same reasoning as migration 0006 for restaurants.photo_attribution --
  // dish photos sourced from Openverse (see scripts/fetch-dish-photos.mjs)
  // carry a Creative Commons license that requires crediting the
  // photographer wherever the photo is shown.
  await pool.query('ALTER TABLE dishes ADD COLUMN photo_attribution TEXT NULL');
}
