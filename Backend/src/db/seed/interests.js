const INTERESTS = [
  { name: 'Foodie', category: 'Food & Dining' },
  { name: 'Coffee Lover', category: 'Food & Dining' },
  { name: 'Fine Dining', category: 'Food & Dining' },
  { name: 'Street Food', category: 'Food & Dining' },
  { name: 'Home Cooking', category: 'Food & Dining' },
  { name: 'Photography', category: 'Arts & Culture' },
  { name: 'Live Music', category: 'Arts & Culture' },
  { name: 'Art & Design', category: 'Arts & Culture' },
  { name: 'Reading', category: 'Arts & Culture' },
  { name: 'Cinema', category: 'Arts & Culture' },
  { name: 'Networking', category: 'Social' },
  { name: 'Conversation', category: 'Social' },
  { name: 'Nightlife', category: 'Social' },
  { name: 'Volunteering', category: 'Social' },
  { name: 'Fitness', category: 'Active' },
  { name: 'Hiking', category: 'Active' },
  { name: 'Travel', category: 'Active' },
  { name: 'Sports', category: 'Active' },
  { name: 'Startups', category: 'Tech & Business' },
  { name: 'Technology', category: 'Tech & Business' },
  { name: 'Entrepreneurship', category: 'Tech & Business' },
  { name: 'Investing', category: 'Tech & Business' },
  { name: 'Fashion', category: 'Lifestyle' },
  { name: 'Wellness', category: 'Lifestyle' },
  { name: 'Pets', category: 'Lifestyle' },
];

export async function seedInterests(db) {
  const { count } = await db.prepare('SELECT COUNT(*) as count FROM interests').get();
  if (count > 0) return;

  const insert = db.prepare('INSERT INTO interests (name, category) VALUES (?, ?)');
  for (const interest of INTERESTS) {
    await insert.run(interest.name, interest.category);
  }
}
