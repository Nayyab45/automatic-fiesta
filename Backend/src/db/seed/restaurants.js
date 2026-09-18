// Self-hosted instead of hotlinked from lh3.googleusercontent.com (Google's
// prototype-hosting CDN) -- an external dependency this app doesn't control.
// Files live in src/assets/images/restaurants (see
// scripts/download-restaurant-images.mjs), served by the /images static
// route in server.js. PUBLIC_ASSET_BASE_URL should be set to the backend's
// real deployed origin once it has one; defaults to localhost for dev.
const ASSET_BASE = process.env.PUBLIC_ASSET_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const asset = (filename) => `${ASSET_BASE}/images/restaurants/${filename}`;

const IMG = {
  haveli: asset('haveli.jpg'),
  haveliChickenKarahi: asset('haveliChickenKarahi.jpg'),
  haveliMuttonKarahi: asset('haveliMuttonKarahi.jpg'),
  haveliSeekhKebab: asset('haveliSeekhKebab.jpg'),
  haveliBbqPlatter: asset('haveliBbqPlatter.jpg'),
  haveliKheer: asset('haveliKheer.jpg'),
  kolachi: asset('kolachi.jpg'),
  kolachiMuttonKarahi: asset('kolachiMuttonKarahi.jpg'),
  xanders: asset('xanders.jpg'),
  javedNihari: asset('javedNihari.jpg'),
  studentBiryani: asset('studentBiryani.jpg'),
  desiCourtyard: asset('desiCourtyard.jpg'),
  desiCourtyardChickenKarahi: asset('desiCourtyardChickenKarahi.jpg'),
  desiCourtyardSeekhKebab: asset('desiCourtyardSeekhKebab.jpg'),
  desiCourtyardKheer: asset('desiCourtyardKheer.jpg'),
};

export const RESTAURANTS = [
  {
    name: 'Haveli Restaurant',
    city: 'Lahore',
    region: 'Punjab',
    cuisineTags: 'Punjabi,Pakistani',
    priceTier: 3,
    rating: 4.8,
    reviewCount: 120,
    description:
      'Set against the backdrop of the historic Badshahi Mosque, Haveli Restaurant offers an unparalleled dining experience that blends rich heritage with culinary excellence.',
    address: 'Fort Road Food Street, Shahi Mohallah Walled City, Lahore, Punjab.',
    photoUrl: IMG.haveli,
    dishes: [
      { name: 'Chicken Karahi', photoUrl: IMG.haveliChickenKarahi, isPopular: true },
      { name: 'Mutton Karahi', photoUrl: IMG.haveliMuttonKarahi, isPopular: true },
      { name: 'Seekh Kebab', photoUrl: IMG.haveliSeekhKebab, isPopular: true },
      { name: 'BBQ Platter', photoUrl: IMG.haveliBbqPlatter, isPopular: true },
      { name: 'Kheer', photoUrl: IMG.haveliKheer, isPopular: true },
    ],
  },
  {
    name: 'Kolachi',
    city: 'Karachi',
    region: 'Sindh',
    cuisineTags: 'Pakistani,BBQ,Seafront Dining',
    priceTier: 4,
    rating: 4.9,
    reviewCount: 345,
    description: 'Seafront dining with sweeping harbor views and a menu built around charcoal-grilled Pakistani classics.',
    address: 'Do Darya, Phase 8, DHA, Karachi.',
    photoUrl: IMG.kolachi,
    dishes: [
      { name: 'Peshawari Karahi', isPopular: true },
      { name: 'Malai Boti', isPopular: true },
      {
        name: 'Mutton Karahi',
        price: 1800,
        description: 'Wok-cooked mutton with tomatoes',
        photoUrl: IMG.kolachiMuttonKarahi,
        rating: 4.7,
        isFeatured: true,
      },
    ],
  },
  {
    name: "Xander's",
    city: 'Karachi',
    region: 'Sindh',
    cuisineTags: 'Cafe,Continental,Desserts',
    priceTier: 2,
    rating: 4.7,
    reviewCount: 210,
    description: 'A relaxed cafe serving continental favorites and desserts, popular for casual catch-ups.',
    address: 'Khayaban-e-Ittehad, Phase 6, DHA, Karachi.',
    photoUrl: IMG.xanders,
    dishes: [],
  },
  {
    name: 'Javed Nihari',
    city: 'Karachi',
    region: 'Sindh',
    cuisineTags: 'Nihari,Pakistani',
    priceTier: 2,
    rating: 4.8,
    reviewCount: 680,
    description: 'A neighborhood institution serving slow-cooked nihari since generations.',
    address: 'Burns Road, Karachi.',
    photoUrl: IMG.javedNihari,
    dishes: [
      {
        name: 'Beef Nihari',
        price: 850,
        description: 'Slow-cooked beef stew with spices',
        photoUrl: IMG.javedNihari,
        rating: 4.8,
        isFeatured: true,
      },
    ],
  },
  {
    name: 'Student Biryani',
    city: 'Karachi',
    region: 'Sindh',
    cuisineTags: 'Biryani,Pakistani',
    priceTier: 1,
    rating: 4.9,
    reviewCount: 920,
    description: 'The city-wide favorite for spiced rice piled high with tender chicken.',
    address: 'Sharah-e-Faisal, Karachi.',
    photoUrl: IMG.studentBiryani,
    dishes: [
      {
        name: 'Chicken Biryani',
        price: 450,
        description: 'Spiced rice mixed with tender chicken',
        photoUrl: IMG.studentBiryani,
        rating: 4.9,
        isFeatured: true,
      },
    ],
  },
  {
    name: 'Desi Courtyard',
    city: 'Lahore',
    region: 'Punjab',
    cuisineTags: 'Pakistani,Upscale',
    priceTier: 4,
    rating: 4.9,
    reviewCount: 95,
    description: 'An upscale outdoor courtyard with string lighting and a refined take on Pakistani classics.',
    address: 'Gulberg III, Lahore.',
    photoUrl: IMG.desiCourtyard,
    dishes: [
      { name: 'Chicken Karahi', description: 'Signature blend', photoUrl: IMG.desiCourtyardChickenKarahi, isPopular: true },
      { name: 'Seekh Kebab', description: 'Charcoal grilled', photoUrl: IMG.desiCourtyardSeekhKebab, isPopular: true },
      { name: 'Kheer', description: 'Classic dessert', photoUrl: IMG.desiCourtyardKheer, isPopular: true },
    ],
  },
  {
    name: 'Bella Notte',
    city: 'Lahore',
    region: 'Punjab',
    cuisineTags: 'Italian',
    priceTier: 3,
    rating: 4.6,
    reviewCount: 150,
    description: 'A cozy Italian trattoria known for wood-fired pizza and handmade pasta.',
    address: 'MM Alam Road, Lahore.',
    photoUrl: IMG.haveli,
    dishes: [],
  },
  {
    name: 'Cafe Aylanto',
    city: 'Karachi',
    region: 'Sindh',
    cuisineTags: 'Continental,Cafe',
    priceTier: 3,
    rating: 4.5,
    reviewCount: 200,
    description: 'A long-running Clifton favorite for continental brunch and coffee.',
    address: 'Zamzama Boulevard, Karachi.',
    photoUrl: IMG.kolachi,
    dishes: [],
  },
  {
    name: 'Okra',
    city: 'Karachi',
    region: 'Sindh',
    cuisineTags: 'Contemporary Pakistani',
    priceTier: 3,
    rating: 4.7,
    reviewCount: 175,
    description: 'A contemporary spin on Pakistani comfort food in a warehouse-chic setting.',
    address: 'Sunset Boulevard, DHA, Karachi.',
    photoUrl: IMG.haveli,
    dishes: [],
  },
  {
    name: 'The Desi Table',
    city: 'Lahore',
    region: 'Punjab',
    cuisineTags: 'Pakistani',
    priceTier: 3,
    rating: 4.6,
    reviewCount: 110,
    description: 'A family-style dining room built for long, conversation-filled meals.',
    address: 'DHA Phase 6, Lahore.',
    photoUrl: IMG.kolachi,
    dishes: [],
  },
  {
    name: 'Monal Islamabad',
    city: 'Islamabad',
    region: 'Federal Capital',
    cuisineTags: 'Continental,Pakistani',
    priceTier: 3,
    rating: 4.6,
    reviewCount: 530,
    description: 'Hilltop dining with panoramic views over Islamabad.',
    address: 'Pir Sohawa Road, Islamabad.',
    photoUrl: IMG.xanders,
    dishes: [],
  },
  {
    name: 'Peshawar Street Kitchen',
    city: 'Peshawar',
    region: 'Khyber Pakhtunkhwa',
    cuisineTags: 'Street Food,Peshawari',
    priceTier: 1,
    rating: 4.5,
    reviewCount: 140,
    description: 'Chapli kebab and namkeen chai served fast, the way the old city does it.',
    address: 'Qissa Khwani Bazaar, Peshawar.',
    photoUrl: IMG.xanders,
    dishes: [],
  },
];

export async function seedRestaurants(db) {
  const { count } = await db.prepare('SELECT COUNT(*) as count FROM restaurants').get();
  if (count > 0) return;

  const insertRestaurant = db.prepare(`
    INSERT INTO restaurants (name, city, region, cuisine_tags, price_tier, rating, review_count, description, address, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertDish = db.prepare(`
    INSERT INTO dishes (restaurant_id, name, price, description, photo_url, rating, is_popular, is_featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const restaurant of RESTAURANTS) {
    // rating/reviewCount always start null/0 here, ignoring whatever's on
    // the RESTAURANTS object above (leftover placeholder numbers from the
    // original static prototype -- e.g. "4.9, 920 reviews" for a restaurant
    // nobody has actually reviewed in the app yet). restaurants.js's own
    // review-posting handler is the only thing that should ever set these,
    // same as every real (OSM-imported) restaurant already gets.
    const result = await insertRestaurant.run(
      restaurant.name,
      restaurant.city,
      restaurant.region,
      restaurant.cuisineTags,
      restaurant.priceTier,
      null,
      0,
      restaurant.description ?? null,
      restaurant.address ?? null,
      restaurant.photoUrl ?? null,
    );
    for (const dish of restaurant.dishes) {
      await insertDish.run(
        result.lastInsertRowid,
        dish.name,
        dish.price ?? null,
        dish.description ?? null,
        dish.photoUrl ?? null,
        dish.rating ?? null,
        dish.isPopular ? 1 : 0,
        dish.isFeatured ? 1 : 0,
      );
    }
  }
}
