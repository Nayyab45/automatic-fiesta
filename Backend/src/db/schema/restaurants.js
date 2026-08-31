export const restaurantsSchema = `
  CREATE TABLE IF NOT EXISTS restaurants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    cuisine_tags VARCHAR(255) NOT NULL,
    price_tier INT NOT NULL,
    rating DOUBLE NOT NULL,
    review_count INT NOT NULL,
    description TEXT,
    address TEXT,
    photo_url TEXT,
    -- Nullable: only populated for the seeded restaurants (geocoded via
    -- OpenStreetMap's Nominatim, see scripts/geocode-restaurants.mjs) --
    -- a restaurant added later without coordinates just doesn't get a map
    -- pin, rather than blocking the row from being created.
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dishes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DOUBLE,
    description TEXT,
    photo_url TEXT,
    rating DOUBLE,
    is_popular TINYINT(1) NOT NULL DEFAULT 0,
    is_featured TINYINT(1) NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS saved_restaurants (
    user_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, restaurant_id)
  );
`;
