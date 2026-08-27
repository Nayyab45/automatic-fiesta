import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';

export const profileRouter = Router();
export const interestsRouter = Router();
export const peopleRouter = Router();
export const matchesRouter = Router();

profileRouter.use(requireAuth);
peopleRouter.use(requireAuth);
matchesRouter.use(requireAuth);

function tablesJoinedCount(userId) {
  const { count } = db
    .prepare(
      `SELECT COUNT(DISTINCT t.id) as count FROM dining_tables t
       LEFT JOIN table_guests g ON g.table_id = t.id AND g.user_id = ?
       WHERE t.host_user_id = ? OR g.user_id = ?`,
    )
    .get(userId, userId, userId);
  return count;
}

function hostRating(userId) {
  const row = db
    .prepare(
      `SELECT AVG(r.overall_rating) as avg FROM reviews r
       JOIN dining_tables t ON t.id = r.table_id
       WHERE t.host_user_id = ? AND r.overall_rating IS NOT NULL`,
    )
    .get(userId);
  return row.avg ? Math.round(row.avg * 10) / 10 : null;
}

function interestsFor(userId) {
  return toCamelRows(
    db
      .prepare(
        `SELECT i.id, i.name, i.category FROM interests i
         JOIN user_interests ui ON ui.interest_id = i.id
         WHERE ui.user_id = ?`,
      )
      .all(userId),
  );
}

function fullProfile(userId) {
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  const foodPrefs = db.prepare('SELECT * FROM food_preferences WHERE user_id = ?').get(userId);
  const dietaryPrefs = db.prepare('SELECT * FROM dietary_preferences WHERE user_id = ?').get(userId);
  const matchPrefs = db.prepare('SELECT * FROM match_preferences WHERE user_id = ?').get(userId);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    age: profile?.age ?? null,
    bio: profile?.bio ?? null,
    city: profile?.city ?? null,
    province: profile?.province ?? null,
    photoUrl: profile?.photo_url ?? null,
    verified: !!profile?.verified,
    tablesJoinedCount: tablesJoinedCount(userId),
    rating: hostRating(userId),
    favoriteFoods: foodPrefs?.favorite_foods ? foodPrefs.favorite_foods.split(',') : [],
    dietaryNeeds: dietaryPrefs?.needs ? dietaryPrefs.needs.split(',') : [],
    spiceTolerance: dietaryPrefs?.spice_tolerance ?? null,
    maxDistanceKm: matchPrefs?.max_distance_km ?? null,
    diningTimes: matchPrefs?.dining_times ? matchPrefs.dining_times.split(',') : [],
    interests: interestsFor(userId),
  };
}

interestsRouter.get('/', requireAuth, (_req, res) => {
  res.json({ interests: toCamelRows(db.prepare('SELECT * FROM interests ORDER BY category, name').all()) });
});

profileRouter.get('/me', (req, res) => {
  res.json({ profile: fullProfile(req.user.sub) });
});

profileRouter.get('/:id', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ profile: fullProfile(user.id) });
});

profileRouter.put('/me', (req, res) => {
  const { age, bio, city, province, photoUrl } = req.body ?? {};
  db.prepare(
    `INSERT INTO user_profiles (user_id, age, bio, city, province, photo_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET age = excluded.age, bio = excluded.bio, city = excluded.city,
       province = excluded.province, photo_url = excluded.photo_url, updated_at = datetime('now')`,
  ).run(req.user.sub, age ?? null, bio ?? null, city ?? null, province ?? null, photoUrl ?? null);
  res.json({ profile: fullProfile(req.user.sub) });
});

profileRouter.put('/me/interests', (req, res) => {
  const { interestIds } = req.body ?? {};
  db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(req.user.sub);
  const insert = db.prepare('INSERT OR IGNORE INTO user_interests (user_id, interest_id) VALUES (?, ?)');
  for (const id of interestIds ?? []) {
    insert.run(req.user.sub, id);
  }
  res.json({ interests: interestsFor(req.user.sub) });
});

profileRouter.put('/me/food-preferences', (req, res) => {
  const { favoriteFoods } = req.body ?? {};
  db.prepare(
    `INSERT INTO food_preferences (user_id, favorite_foods) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET favorite_foods = excluded.favorite_foods`,
  ).run(req.user.sub, (favoriteFoods ?? []).join(','));
  res.json({ favoriteFoods: favoriteFoods ?? [] });
});

profileRouter.put('/me/dietary-preferences', (req, res) => {
  const { needs, spiceTolerance } = req.body ?? {};
  db.prepare(
    `INSERT INTO dietary_preferences (user_id, needs, spice_tolerance) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET needs = excluded.needs, spice_tolerance = excluded.spice_tolerance`,
  ).run(req.user.sub, (needs ?? []).join(','), spiceTolerance ?? null);
  res.json({ needs: needs ?? [], spiceTolerance: spiceTolerance ?? null });
});

profileRouter.put('/me/match-preferences', (req, res) => {
  const { maxDistanceKm, diningTimes } = req.body ?? {};
  db.prepare(
    `INSERT INTO match_preferences (user_id, max_distance_km, dining_times) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET max_distance_km = excluded.max_distance_km, dining_times = excluded.dining_times`,
  ).run(req.user.sub, maxDistanceKm ?? null, (diningTimes ?? []).join(','));
  res.json({ maxDistanceKm: maxDistanceKm ?? null, diningTimes: diningTimes ?? [] });
});

peopleRouter.get('/', (req, res) => {
  const { city } = req.query;
  const clauses = ['u.id != ?'];
  const params = [req.user.sub];
  if (city) {
    clauses.push('p.city = ?');
    params.push(city);
  }

  const rows = db
    .prepare(
      `SELECT u.id, u.name, p.age, p.city, p.bio, p.photo_url, p.verified FROM users u
       JOIN user_profiles p ON p.user_id = u.id
       WHERE ${clauses.join(' AND ')}`,
    )
    .all(...params);

  const people = toCamelRows(rows).map((person) => ({ ...person, interests: interestsFor(person.id) }));
  res.json({ people });
});

matchesRouter.get('/', (req, res) => {
  const myInterestIds = new Set(interestsFor(req.user.sub).map((i) => i.id));
  const myProfile = db.prepare('SELECT city FROM user_profiles WHERE user_id = ?').get(req.user.sub);

  const candidates = toCamelRows(
    db
      .prepare(
        `SELECT u.id, u.name, p.age, p.city, p.bio, p.photo_url, p.verified FROM users u
         JOIN user_profiles p ON p.user_id = u.id
         WHERE u.id != ?`,
      )
      .all(req.user.sub),
  );

  const matches = candidates
    .map((candidate) => {
      const candidateInterests = interestsFor(candidate.id);
      const sharedInterests = candidateInterests.filter((i) => myInterestIds.has(i.id));
      const sameCity = myProfile?.city && myProfile.city === candidate.city;
      const score = sharedInterests.length * 15 + (sameCity ? 20 : 0);
      const reasons = [];
      if (sharedInterests.length > 0) {
        reasons.push(`Shares your interest in ${sharedInterests[0].name}`);
      }
      if (sameCity) {
        reasons.push(`Also based in ${candidate.city}`);
      }
      return {
        ...candidate,
        score: Math.min(score, 99),
        sharedInterests,
        reasons,
        rating: hostRating(candidate.id),
        tablesJoinedCount: tablesJoinedCount(candidate.id),
      };
    })
    .sort((a, b) => b.score - a.score);

  res.json({ matches });
});
