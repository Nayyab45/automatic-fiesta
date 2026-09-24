export async function up(pool) {
  // A per-participant "delete this conversation from my inbox" -- the other
  // person's copy (and the message history itself) is untouched, matching
  // how most chat apps' "delete chat" only ever affects your own list. NULL
  // means never deleted; set once and read back by GET /conversations (see
  // messaging.js), which also un-hides a conversation the moment a message
  // lands after this timestamp, so a reply someone sends you after you
  // deleted the thread doesn't just vanish.
  await pool.query('ALTER TABLE conversation_participants ADD COLUMN deleted_at DATETIME NULL');

  // Same idea for a dining table's group chat, but table membership (host or
  // table_guests) has no single row per person to add a column to, and the
  // host in particular has no table_guests row at all -- a small side table
  // keyed by (table_id, user_id) covers both. Hiding a table's chat never
  // touches table_guests itself, so it's purely cosmetic: the event, seat and
  // any other participant's view of the chat are all unaffected.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS table_chat_hides (
      table_id INT NOT NULL,
      user_id INT NOT NULL,
      hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (table_id, user_id)
    )
  `);
}
