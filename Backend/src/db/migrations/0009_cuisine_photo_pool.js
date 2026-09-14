export async function up(pool) {
  // Previously one shared stock photo per cuisine (PK on `cuisine` alone),
  // which made every restaurant sharing a cuisine render the identical
  // photo. Dropping that uniqueness lets several distinct photos be cached
  // per cuisine and spread across the restaurants that share it -- see
  // getOrCreateCuisinePhoto in restaurantPhotos.js.
  await pool.query('ALTER TABLE cuisine_stock_photos DROP PRIMARY KEY');
  await pool.query('ALTER TABLE cuisine_stock_photos ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST');
  await pool.query('ALTER TABLE cuisine_stock_photos ADD INDEX idx_cuisine (cuisine)');
}
