export const profilesSchema = `
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    age INTEGER,
    bio TEXT,
    city TEXT,
    province TEXT,
    photo_url TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_interests (
    user_id INTEGER NOT NULL REFERENCES users(id),
    interest_id INTEGER NOT NULL REFERENCES interests(id),
    PRIMARY KEY (user_id, interest_id)
  );

  CREATE TABLE IF NOT EXISTS food_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    favorite_foods TEXT
  );

  CREATE TABLE IF NOT EXISTS dietary_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    needs TEXT,
    spice_tolerance TEXT
  );

  CREATE TABLE IF NOT EXISTS match_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    max_distance_km INTEGER,
    dining_times TEXT
  );
`;
