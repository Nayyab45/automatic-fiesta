export async function up(pool) {
  // Photos sourced from Openverse (see src/lib/restaurantPhotos.js) are
  // Creative-Commons-licensed, not royalty-free -- most licenses in that
  // family require crediting the photographer wherever the photo is shown,
  // so the credit travels with the photo rather than being looked up later.
  await pool.query('ALTER TABLE restaurants ADD COLUMN photo_attribution TEXT NULL');
  await pool.query('ALTER TABLE cuisine_stock_photos ADD COLUMN attribution TEXT NULL');
}
