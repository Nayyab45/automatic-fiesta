import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const profileRouter = Router();
export const interestsRouter = Router();
export const peopleRouter = Router();
export const matchesRouter = Router();
export const privacySettingsRouter = Router();

profileRouter.use(requireAuth);
peopleRouter.use(requireAuth);
matchesRouter.use(requireAuth);
privacySettingsRouter.use(requireAuth);

const DEFAULT_PRIVACY_SETTINGS = {
  profileVisible: true,
  showMutualInterests: true,
  showOnlineStatus: false,
  showProfileViews: false,
  locationPrecision: 'approximate',
};

async function privacySettingsFor(userId) {
  const row = await db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(userId);
  if (!row) return { ...DEFAULT_PRIVACY_SETTINGS };
  return {
    profileVisible: !!row.profile_visible,
    showMutualInterests: !!row.show_mutual_interests,
    showOnlineStatus: !!row.show_online_status,
    showProfileViews: !!row.show_profile_views,
    locationPrecision: row.location_precision,
  };
}

async function tablesJoinedCount(userId) {
  const { count } = await db
    .prepare(
      `SELECT COUNT(DISTINCT t.id) as count FROM dining_tables t
       LEFT JOIN table_guests g ON g.table_id = t.id AND g.user_id = ?
       WHERE t.host_user_id = ? OR g.user_id = ?`,
    )
    .get(userId, userId, userId);
  return count;
}

async function hostRating(userId) {
  const row = await db
    .prepare(
      `SELECT AVG(r.overall_rating) as avg FROM reviews r
       JOIN dining_tables t ON t.id = r.table_id
       WHERE t.host_user_id = ? AND r.overall_rating IS NOT NULL`,
    )
    .get(userId);
  return row.avg ? Math.round(row.avg * 10) / 10 : null;
}

async function interestsFor(userId) {
  return toCamelRows(
    await db
      .prepare(
        `SELECT i.id, i.name, i.category FROM interests i
         JOIN user_interests ui ON ui.interest_id = i.id
         WHERE ui.user_id = ?`,
      )
      .all(userId),
  );
}

async function fullProfile(userId) {
  const user = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
  const profile = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  const foodPrefs = await db.prepare('SELECT * FROM food_preferences WHERE user_id = ?').get(userId);
  const dietaryPrefs = await db.prepare('SELECT * FROM dietary_preferences WHERE user_id = ?').get(userId);
  const matchPrefs = await db.prepare('SELECT * FROM match_preferences WHERE user_id = ?').get(userId);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    age: profile?.age ?? null,
    bio: profile?.bio ?? null,
    city: profile?.city ?? null,
    province: profile?.province ?? null,
    photoUrl: profile?.photo_url ?? null,
    phone: profile?.phone ?? null,
    verified: !!profile?.verified,
    tablesJoinedCount: await tablesJoinedCount(userId),
    rating: await hostRating(userId),
    favoriteFoods: foodPrefs?.favorite_foods ? foodPrefs.favorite_foods.split(',') : [],
    dietaryNeeds: dietaryPrefs?.needs ? dietaryPrefs.needs.split(',') : [],
    spiceTolerance: dietaryPrefs?.spice_tolerance ?? null,
    maxDistanceKm: matchPrefs?.max_distance_km ?? null,
    diningTimes: matchPrefs?.dining_times ? matchPrefs.dining_times.split(',') : [],
    interests: await interestsFor(userId),
  };
}

interestsRouter.get('/', requireAuth, asyncHandler(async (_req, res) => {
  res.json({ interests: toCamelRows(await db.prepare('SELECT * FROM interests ORDER BY category, name').all()) });
}));

profileRouter.get('/me', asyncHandler(async (req, res) => {
  res.json({ profile: await fullProfile(req.user.sub) });
}));

profileRouter.get('/:id', asyncHandler(async (req, res) => {
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ profile: await fullProfile(user.id) });
}));

// Merges onto the existing row rather than overwriting wholesale, since
// callers now legitimately send partial updates (avatar-only from
// manage-account's photo picker, phone-only from its edit-phone prompt)
// alongside profile-creation's full-form save.
profileRouter.put('/me', asyncHandler(async (req, res) => {
  const { age, bio, city, province, photoUrl, phone } = req.body ?? {};
  const existing = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.sub);

  const merged = {
    age: age !== undefined ? age : (existing?.age ?? null),
    bio: bio !== undefined ? bio : (existing?.bio ?? null),
    city: city !== undefined ? city : (existing?.city ?? null),
    province: province !== undefined ? province : (existing?.province ?? null),
    photoUrl: photoUrl !== undefined ? photoUrl : (existing?.photo_url ?? null),
    phone: phone !== undefined ? phone : (existing?.phone ?? null),
  };

  await db.prepare(
    `INSERT INTO user_profiles (user_id, age, bio, city, province, photo_url, phone, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE age = VALUES(age), bio = VALUES(bio), city = VALUES(city),
       province = VALUES(province), photo_url = VALUES(photo_url), phone = VALUES(phone), updated_at = NOW()`,
  ).run(req.user.sub, merged.age, merged.bio, merged.city, merged.province, merged.photoUrl, merged.phone);
  res.json({ profile: await fullProfile(req.user.sub) });
}));

profileRouter.put('/me/interests', asyncHandler(async (req, res) => {
  const { interestIds } = req.body ?? {};
  await db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(req.user.sub);
  const insert = db.prepare('INSERT IGNORE INTO user_interests (user_id, interest_id) VALUES (?, ?)');
  for (const id of interestIds ?? []) {
    await insert.run(req.user.sub, id);
  }
  res.json({ interests: await interestsFor(req.user.sub) });
}));

profileRouter.put('/me/food-preferences', asyncHandler(async (req, res) => {
  const { favoriteFoods } = req.body ?? {};
  await db.prepare(
    `INSERT INTO food_preferences (user_id, favorite_foods) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE favorite_foods = VALUES(favorite_foods)`,
  ).run(req.user.sub, (favoriteFoods ?? []).join(','));
  res.json({ favoriteFoods: favoriteFoods ?? [] });
}));

profileRouter.put('/me/dietary-preferences', asyncHandler(async (req, res) => {
  const { needs, spiceTolerance } = req.body ?? {};
  await db.prepare(
    `INSERT INTO dietary_preferences (user_id, needs, spice_tolerance) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE needs = VALUES(needs), spice_tolerance = VALUES(spice_tolerance)`,
  ).run(req.user.sub, (needs ?? []).join(','), spiceTolerance ?? null);
  res.json({ needs: needs ?? [], spiceTolerance: spiceTolerance ?? null });
}));

profileRouter.put('/me/match-preferences', asyncHandler(async (req, res) => {
  const { maxDistanceKm, diningTimes } = req.body ?? {};
  await db.prepare(
    `INSERT INTO match_preferences (user_id, max_distance_km, dining_times) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE max_distance_km = VALUES(max_distance_km), dining_times = VALUES(dining_times)`,
  ).run(req.user.sub, maxDistanceKm ?? null, (diningTimes ?? []).join(','));
  res.json({ maxDistanceKm: maxDistanceKm ?? null, diningTimes: diningTimes ?? [] });
}));

// Excluded from both `people` and `matches`: anyone in either direction of a
// block relationship, so a block actually stops two users from seeing each
// other rather than just hiding a "block" affordance.
const NOT_BLOCKED_CLAUSE = `u.id NOT IN (
  SELECT blocked_user_id FROM user_blocks WHERE blocker_user_id = ?
  UNION
  SELECT blocker_user_id FROM user_blocks WHERE blocked_user_id = ?
)`;

// Respects privacy-settings' "Show my profile to nearby users" toggle: a row
// missing from privacy_settings defaults to visible, matching
// DEFAULT_PRIVACY_SETTINGS below.
const PROFILE_VISIBLE_CLAUSE = `u.id NOT IN (
  SELECT user_id FROM privacy_settings WHERE profile_visible = 0
)`;

peopleRouter.get('/', asyncHandler(async (req, res) => {
  const { city } = req.query;
  const clauses = ['u.id != ?', NOT_BLOCKED_CLAUSE, PROFILE_VISIBLE_CLAUSE];
  const params = [req.user.sub, req.user.sub, req.user.sub];
  if (city) {
    clauses.push('p.city = ?');
    params.push(city);
  }

  const rows = await db
    .prepare(
      `SELECT u.id, u.name, p.age, p.city, p.bio, p.photo_url, p.verified FROM users u
       JOIN user_profiles p ON p.user_id = u.id
       WHERE ${clauses.join(' AND ')}`,
    )
    .all(...params);

  const people = await Promise.all(
    toCamelRows(rows).map(async (person) => ({ ...person, interests: await interestsFor(person.id) })),
  );
  res.json({ people });
}));

matchesRouter.get('/', asyncHandler(async (req, res) => {
  const myInterestIds = new Set((await interestsFor(req.user.sub)).map((i) => i.id));
  const myProfile = await db.prepare('SELECT city FROM user_profiles WHERE user_id = ?').get(req.user.sub);

  const candidates = toCamelRows(
    await db
      .prepare(
        `SELECT u.id, u.name, p.age, p.city, p.bio, p.photo_url, p.verified FROM users u
         JOIN user_profiles p ON p.user_id = u.id
         WHERE u.id != ? AND ${NOT_BLOCKED_CLAUSE} AND ${PROFILE_VISIBLE_CLAUSE}`,
      )
      .all(req.user.sub, req.user.sub, req.user.sub),
  );

  const matches = (
    await Promise.all(
      candidates.map(async (candidate) => {
        const candidateInterests = await interestsFor(candidate.id);
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
          rating: await hostRating(candidate.id),
          tablesJoinedCount: await tablesJoinedCount(candidate.id),
        };
      }),
    )
  ).sort((a, b) => b.score - a.score);

  res.json({ matches });
}));

privacySettingsRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ settings: await privacySettingsFor(req.user.sub) });
}));

privacySettingsRouter.put('/', asyncHandler(async (req, res) => {
  const existing = await privacySettingsFor(req.user.sub);
  const merged = { ...existing, ...req.body };

  await db.prepare(
    `INSERT INTO privacy_settings
       (user_id, profile_visible, show_mutual_interests, show_online_status, show_profile_views, location_precision, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE profile_visible = VALUES(profile_visible),
       show_mutual_interests = VALUES(show_mutual_interests), show_online_status = VALUES(show_online_status),
       show_profile_views = VALUES(show_profile_views), location_precision = VALUES(location_precision),
       updated_at = NOW()`,
  ).run(
    req.user.sub,
    merged.profileVisible ? 1 : 0,
    merged.showMutualInterests ? 1 : 0,
    merged.showOnlineStatus ? 1 : 0,
    merged.showProfileViews ? 1 : 0,
    merged.locationPrecision,
  );

  res.json({ settings: await privacySettingsFor(req.user.sub) });
}));
