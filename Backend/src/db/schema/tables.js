export const tablesSchema = `
  CREATE TABLE IF NOT EXISTS dining_tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    restaurant_id INT NOT NULL,
    host_user_id INT NOT NULL,
    gathering_type VARCHAR(100) NOT NULL,
    date_time VARCHAR(40) NOT NULL,
    seats_total INT NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'public',
    atmosphere VARCHAR(255),
    note TEXT,
    price_per_person DOUBLE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS table_guests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_id INT NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(100),
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS seat_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_id INT NOT NULL,
    user_id INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','confirmed','declined')),
    message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS check_ins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_id INT NOT NULL,
    user_id INT NOT NULL,
    checked_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_out_at DATETIME NULL,
    UNIQUE(table_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_id INT NOT NULL,
    reviewer_user_id INT NOT NULL,
    food_rating INT,
    restaurant_rating INT,
    conversation_rating INT,
    overall_rating INT,
    dine_again VARCHAR(20),
    comment TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_id, reviewer_user_id)
  );
`;
