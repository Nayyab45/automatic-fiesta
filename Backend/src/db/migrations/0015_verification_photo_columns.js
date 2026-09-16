export async function up(pool) {
  // These stored a real phone photo's base64 data URL and were plain TEXT
  // (65,535 bytes max) -- profiles.photo_url hit this exact problem first
  // and was widened to MEDIUMTEXT (see schema/profiles.js); these three
  // never got the same fix, so any real (non-tiny-test) photo failed to
  // save with a MySQL "Data too long for column" error. Client-side
  // resizing (see image-resize.ts, now used on these upload pages too)
  // keeps photos well under even TEXT's limit in practice, but MEDIUMTEXT
  // is the same safety margin every other stored photo in this app gets.
  await pool.query('ALTER TABLE identity_verifications MODIFY COLUMN id_front_url MEDIUMTEXT');
  await pool.query('ALTER TABLE identity_verifications MODIFY COLUMN id_back_url MEDIUMTEXT');
  await pool.query('ALTER TABLE identity_verifications MODIFY COLUMN selfie_url MEDIUMTEXT');
}
