export const tablesSchema = `
  CREATE TABLE IF NOT EXISTS dining_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    host_user_id INTEGER NOT NULL REFERENCES users(id),
    gathering_type TEXT NOT NULL,
    date_time TEXT NOT NULL,
    seats_total INTEGER NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public',
    atmosphere TEXT,
    note TEXT,
    price_per_person REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS table_guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL REFERENCES dining_tables(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(table_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS seat_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL REFERENCES dining_tables(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','confirmed','declined')),
    message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS check_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL REFERENCES dining_tables(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
    checked_out_at TEXT,
    UNIQUE(table_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL REFERENCES dining_tables(id),
    reviewer_user_id INTEGER NOT NULL REFERENCES users(id),
    food_rating INTEGER,
    restaurant_rating INTEGER,
    conversation_rating INTEGER,
    overall_rating INTEGER,
    dine_again TEXT,
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(table_id, reviewer_user_id)
  );
`;
