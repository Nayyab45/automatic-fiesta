export async function up(pool) {
  // Two-factor authentication has been removed from the app entirely -- see
  // the deleted /auth/2fa/* routes and the twoFactor checks removed from
  // /login and /google. Reverses 0002_add_two_factor_auth.js.
  await pool.query('DROP TABLE IF EXISTS two_factor_auth');
}
