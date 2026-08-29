export const settingsSchema = `
  CREATE TABLE IF NOT EXISTS privacy_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    profile_visible INTEGER NOT NULL DEFAULT 1,
    show_mutual_interests INTEGER NOT NULL DEFAULT 1,
    show_online_status INTEGER NOT NULL DEFAULT 0,
    show_profile_views INTEGER NOT NULL DEFAULT 0,
    location_precision TEXT NOT NULL DEFAULT 'approximate',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;
