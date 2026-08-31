export const profilesSchema = `
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INT PRIMARY KEY,
    age INT,
    bio TEXT,
    city VARCHAR(255),
    province VARCHAR(255),
    photo_url MEDIUMTEXT,
    phone VARCHAR(50),
    verified TINYINT(1) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS interests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_interests (
    user_id INT NOT NULL,
    interest_id INT NOT NULL,
    PRIMARY KEY (user_id, interest_id)
  );

  CREATE TABLE IF NOT EXISTS food_preferences (
    user_id INT PRIMARY KEY,
    favorite_foods TEXT
  );

  CREATE TABLE IF NOT EXISTS dietary_preferences (
    user_id INT PRIMARY KEY,
    needs TEXT,
    spice_tolerance VARCHAR(50)
  );

  CREATE TABLE IF NOT EXISTS match_preferences (
    user_id INT PRIMARY KEY,
    max_distance_km INT,
    dining_times TEXT
  );
`;
