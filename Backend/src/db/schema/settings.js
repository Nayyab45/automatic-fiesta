export const settingsSchema = `
  CREATE TABLE IF NOT EXISTS privacy_settings (
    user_id INT PRIMARY KEY,
    profile_visible TINYINT(1) NOT NULL DEFAULT 1,
    show_mutual_interests TINYINT(1) NOT NULL DEFAULT 1,
    show_online_status TINYINT(1) NOT NULL DEFAULT 0,
    show_profile_views TINYINT(1) NOT NULL DEFAULT 0,
    location_precision VARCHAR(20) NOT NULL DEFAULT 'approximate',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;
