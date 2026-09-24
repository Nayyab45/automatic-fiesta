export async function up(pool) {
  // Sibling to notify_on_checkin (0002-era emergency_contacts schema) --
  // notify_on_checkin covers "they arrived", notify_on_no_checkout covers
  // "they never checked out", but neither fires the moment someone actually
  // leaves safely. See tables.js's notifyEmergencyContactsOfCheckStatus.
  await pool.query('ALTER TABLE emergency_contacts ADD COLUMN notify_on_checkout TINYINT(1) NOT NULL DEFAULT 1');
}
