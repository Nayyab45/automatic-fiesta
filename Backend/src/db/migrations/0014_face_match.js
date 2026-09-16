export async function up(pool) {
  // The Face++ confidence score (0-100) from comparing the selfie against
  // the ID photo at submission time -- see lib/faceMatch.js. NULL means no
  // automated comparison ever ran for this submission (FACEPP_API_KEY
  // unset, or Face++ couldn't reach a verdict), not that it scored zero.
  await pool.query('ALTER TABLE identity_verifications ADD COLUMN face_match_confidence DOUBLE NULL');
}
