export async function up(pool) {
  // Set by the host once the real bill is known (typically after the meal),
  // distinct from price_per_person -- which is only ever an upfront
  // per-person estimate set at creation time, and gets nothing back from
  // this. Once total_bill is set, tableWithContext (see tables.js) derives
  // the actual per-person share by splitting it across the current guest
  // count, instead of trusting the estimate.
  await pool.query('ALTER TABLE dining_tables ADD COLUMN total_bill DOUBLE NULL');
}
