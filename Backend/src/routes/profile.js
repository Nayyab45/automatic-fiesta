import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { tastePrefsFor, distanceKm } from '../lib/taste.js';
import { cityCoordinates } from '../lib/cityGeocode.js';
import { subscriptionFor, activePremiumUserIds } from './subscriptions.js';
import { tableCreationStatus } from './tables.js';

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

// Average of ratings left by fellow attendees of tables this person has
// shared (see tablesRouter's /:id/rate in tables.js) -- rating them as a
// dining companion, not the (unrelated) food/restaurant/conversation
// review a table's reviews carry.
async function peopleRating(userId) {
  const row = await db.prepare('SELECT AVG(score) as avg FROM user_ratings WHERE rated_user_id = ?').get(userId);
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

// Batched version of interestsFor for a whole candidate list (Discover
// People) -- one query total instead of one per person, same reasoning as
// attachDishesBatch in restaurants.js.
async function interestsForBatch(userIds) {
  if (!userIds.length) return new Map();
  const placeholders = userIds.map(() => '?').join(',');
  const rows = toCamelRows(
    await db
      .prepare(
        `SELECT ui.user_id, i.id, i.name, i.category FROM user_interests ui
         JOIN interests i ON i.id = ui.interest_id
         WHERE ui.user_id IN (${placeholders})`,
      )
      .all(...userIds),
  );
  const byUserId = new Map();
  for (const row of rows) {
    const list = byUserId.get(row.userId) ?? [];
    list.push({ id: row.id, name: row.name, category: row.category });
    byUserId.set(row.userId, list);
  }
  return byUserId;
}

// Same batching, for the comma-separated favorite_foods each candidate set
// in Food Preferences (see food-preferences.page.ts) -- what the "Cuisine"
// filter on Discover People actually matches against.
async function favoriteFoodsForBatch(userIds) {
  if (!userIds.length) return new Map();
  const placeholders = userIds.map(() => '?').join(',');
  const rows = await db
    .prepare(`SELECT user_id, favorite_foods FROM food_preferences WHERE user_id IN (${placeholders})`)
    .all(...userIds);
  const byUserId = new Map();
  for (const row of rows) {
    byUserId.set(row.user_id, row.favorite_foods ? row.favorite_foods.split(',').filter(Boolean) : []);
  }
  return byUserId;
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
    gender: profile?.gender ?? null,
    verified: !!profile?.verified,
    isPremium: (await subscriptionFor(userId)).status === 'active',
    tablesJoinedCount: await tablesJoinedCount(userId),
    rating: await peopleRating(userId),
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

// Preferences are meant to be fairly stable (they feed the matching
// algorithm -- see matches.js/matchesRouter below), so changing them is
// capped at MONTHLY_PREFERENCE_CHANGE_LIMIT per calendar month instead of
// being unlimited. Calendar month (not a rolling 30 days) so "resets on the
// 1st" is a simple, predictable date to show the user, not something that
// depends on exactly when their prior changes happened to land.
const MONTHLY_PREFERENCE_CHANGE_LIMIT = 2;

async function preferenceChangeStatus(userId) {
  const { usedCount } = await db
    .prepare(
      `SELECT COUNT(*) as usedCount FROM preference_updates
       WHERE user_id = ? AND updated_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
    )
    .get(userId);
  const { nextResetAt } = await db
    .prepare("SELECT DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01') as nextResetAt")
    .get();
  return { remaining: Math.max(0, MONTHLY_PREFERENCE_CHANGE_LIMIT - usedCount), nextResetAt };
}

// Self-only (not part of fullProfile, which is also used for GET /:id) --
// a visitor seeing how many people viewed *your* profile would defeat the
// whole point of the privacy toggle those views are gated behind.
async function profileViewsCount(userId) {
  const { count } = await db.prepare('SELECT COUNT(*) as count FROM profile_views WHERE viewed_user_id = ?').get(userId);
  return count;
}

profileRouter.get('/me', asyncHandler(async (req, res) => {
  res.json({
    profile: await fullProfile(req.user.sub),
    preferenceChanges: await preferenceChangeStatus(req.user.sub),
    tableCreation: await tableCreationStatus(req.user.sub),
    profileViewsCount: await profileViewsCount(req.user.sub),
  });
}));

profileRouter.get('/:id', asyncHandler(async (req, res) => {
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  await recordProfileView(req.user.sub, user.id);
  res.json({ profile: await fullProfile(user.id) });
}));

// Only recorded when the viewer's own "show my profile views" privacy
// setting is on -- same toggle already used for that purpose (see
// privacySettingsRouter below) -- and never for a self-view. Upserts rather
// than inserting so re-visiting someone's profile just bumps viewed_at
// instead of the "who viewed you" list filling up with repeat entries.
async function recordProfileView(viewerUserId, viewedUserId) {
  if (viewerUserId === viewedUserId) return;
  const { showProfileViews } = await privacySettingsFor(viewerUserId);
  if (!showProfileViews) return;
  await db.prepare(
    `INSERT INTO profile_views (viewer_user_id, viewed_user_id, viewed_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE viewed_at = NOW()`,
  ).run(viewerUserId, viewedUserId);
}

// Premium-only: who has viewed my profile recently (most recent first).
// Free accounts get a 402 rather than a silently-empty list, matching how
// subscriptionsRouter's checkout responds to an unconfigured gateway.
profileRouter.get('/me/viewers', asyncHandler(async (req, res) => {
  const subscription = await subscriptionFor(req.user.sub);
  if (subscription.status !== 'active') {
    return res.status(402).json({ message: 'Upgrade to Premium to see who viewed your profile.' });
  }

  const rows = toCamelRows(
    await db
      .prepare(
        `SELECT u.id, u.name, p.photo_url, p.verified, pv.viewed_at FROM profile_views pv
         JOIN users u ON u.id = pv.viewer_user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE pv.viewed_user_id = ?
         ORDER BY pv.viewed_at DESC
         LIMIT 50`,
      )
      .all(req.user.sub),
  );
  res.json({ viewers: rows });
}));

// Merges onto the existing row rather than overwriting wholesale, since
// callers now legitimately send partial updates (avatar-only from
// manage-account's photo picker, phone-only from its edit-phone prompt)
// alongside profile-creation's full-form save.
profileRouter.put('/me', asyncHandler(async (req, res) => {
  const { age, bio, city, province, photoUrl, phone, gender } = req.body ?? {};
  const existing = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.sub);

  const merged = {
    age: age !== undefined ? age : (existing?.age ?? null),
    bio: bio !== undefined ? bio : (existing?.bio ?? null),
    city: city !== undefined ? city : (existing?.city ?? null),
    province: province !== undefined ? province : (existing?.province ?? null),
    photoUrl: photoUrl !== undefined ? photoUrl : (existing?.photo_url ?? null),
    phone: phone !== undefined ? phone : (existing?.phone ?? null),
    gender: gender !== undefined ? gender : (existing?.gender ?? null),
  };

  await db.prepare(
    `INSERT INTO user_profiles (user_id, age, bio, city, province, photo_url, phone, gender, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE age = VALUES(age), bio = VALUES(bio), city = VALUES(city),
       province = VALUES(province), photo_url = VALUES(photo_url), phone = VALUES(phone),
       gender = VALUES(gender), updated_at = NOW()`,
  ).run(req.user.sub, merged.age, merged.bio, merged.city, merged.province, merged.photoUrl, merged.phone, merged.gender);
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

// Consolidated save used by the Edit Preferences page (as opposed to the
// three endpoints above, which are the one-time onboarding steps for each
// preference type and are NOT rate-limited -- setting your preferences for
// the first time isn't a "change"). One save here uses up one of this
// user's MONTHLY_PREFERENCE_CHANGE_LIMIT changes, covering food + dietary +
// match together, since the page's own "Save Preferences" button already
// saves all three as a single user action.
profileRouter.put('/me/preferences', asyncHandler(async (req, res) => {
  const status = await preferenceChangeStatus(req.user.sub);
  if (status.remaining <= 0) {
    return res.status(429).json({
      message: `You've used your ${MONTHLY_PREFERENCE_CHANGE_LIMIT} preference changes for this month. Next change available ${status.nextResetAt}.`,
      preferenceChanges: status,
    });
  }

  const { favoriteFoods, needs, spiceTolerance, maxDistanceKm, diningTimes } = req.body ?? {};
  await db.prepare(
    `INSERT INTO food_preferences (user_id, favorite_foods) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE favorite_foods = VALUES(favorite_foods)`,
  ).run(req.user.sub, (favoriteFoods ?? []).join(','));
  await db.prepare(
    `INSERT INTO dietary_preferences (user_id, needs, spice_tolerance) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE needs = VALUES(needs), spice_tolerance = VALUES(spice_tolerance)`,
  ).run(req.user.sub, (needs ?? []).join(','), spiceTolerance ?? null);
  await db.prepare(
    `INSERT INTO match_preferences (user_id, max_distance_km, dining_times) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE max_distance_km = VALUES(max_distance_km), dining_times = VALUES(dining_times)`,
  ).run(req.user.sub, maxDistanceKm ?? null, (diningTimes ?? []).join(','));
  await db.prepare('INSERT INTO preference_updates (user_id) VALUES (?)').run(req.user.sub);

  res.json({ profile: await fullProfile(req.user.sub), preferenceChanges: await preferenceChangeStatus(req.user.sub) });
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
  const { city, minAge, maxAge, interestIds, cuisine, lat, lng, maxDistanceKm } = req.query;
  const clauses = ['u.id != ?', NOT_BLOCKED_CLAUSE, PROFILE_VISIBLE_CLAUSE];
  const params = [req.user.sub, req.user.sub, req.user.sub];
  if (city) {
    clauses.push('p.city = ?');
    params.push(city);
  }
  // A person with no age on file can't be verified as being "in range", so
  // an active age filter excludes them rather than silently including
  // everyone regardless of whether they match.
  if (minAge) {
    clauses.push('p.age IS NOT NULL AND p.age >= ?');
    params.push(Number(minAge));
  }
  if (maxAge) {
    clauses.push('p.age IS NOT NULL AND p.age <= ?');
    params.push(Number(maxAge));
  }

  const rows = await db
    .prepare(
      `SELECT u.id, u.name, p.age, p.city, p.bio, p.photo_url, p.verified FROM users u
       JOIN user_profiles p ON p.user_id = u.id
       WHERE ${clauses.join(' AND ')}`,
    )
    .all(...params);

  let people = toCamelRows(rows);
  const ids = people.map((person) => person.id);
  const [interestsByUserId, favoriteFoodsByUserId, premiumIds] = await Promise.all([
    interestsForBatch(ids),
    favoriteFoodsForBatch(ids),
    activePremiumUserIds(ids),
  ]);
  people = people.map((person) => ({
    ...person,
    interests: interestsByUserId.get(person.id) ?? [],
    favoriteFoods: favoriteFoodsByUserId.get(person.id) ?? [],
    isPremium: premiumIds.has(person.id),
  }));

  const requestedInterestIds = interestIds
    ? String(interestIds).split(',').map(Number).filter((id) => !Number.isNaN(id))
    : [];
  if (requestedInterestIds.length) {
    people = people.filter((person) => person.interests.some((interest) => requestedInterestIds.includes(interest.id)));
  }

  const requestedCuisines = cuisine
    ? String(cuisine).split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
    : [];
  if (requestedCuisines.length) {
    people = people.filter((person) =>
      person.favoriteFoods.some((food) => requestedCuisines.some((c) => food.toLowerCase().includes(c) || c.includes(food.toLowerCase()))),
    );
  }

  // Distance is measured from the viewer's real, live GPS position (lat/lng,
  // sent fresh on every request -- never stored) to each candidate's
  // self-reported city center (see cityGeocode.js) -- there's nowhere this
  // app persists an individual user's own live location. A candidate with
  // no city, or a city that can't be geocoded, is excluded rather than
  // guessed into or out of range.
  const hasCoords = lat !== undefined && lng !== undefined && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  if (hasCoords && maxDistanceKm) {
    const viewerLat = Number(lat);
    const viewerLng = Number(lng);
    const radiusKm = Number(maxDistanceKm);
    const distances = await Promise.all(
      people.map(async (person) => {
        if (!person.city) return null;
        const coords = await cityCoordinates(person.city);
        return coords ? distanceKm(viewerLat, viewerLng, coords.latitude, coords.longitude) : null;
      }),
    );
    people = people
      .map((person, index) => ({ ...person, distanceKm: distances[index] !== null ? Math.round(distances[index] * 10) / 10 : null }))
      .filter((person) => person.distanceKm !== null && person.distanceKm <= radiusKm);
  }

  // Priority profile placement (premium perk): premium profiles sort first
  // as a whole group, ahead of everyone else -- a stable sort, so within
  // each group people keep whatever relative order the filters above left
  // them in rather than being reshuffled.
  people = people
    .map((person, index) => ({ person, index }))
    .sort((a, b) => Number(b.person.isPremium) - Number(a.person.isPremium) || a.index - b.index)
    .map(({ person }) => person);

  res.json({ people: people.map(({ favoriteFoods, ...person }) => person) });
}));

matchesRouter.get('/', asyncHandler(async (req, res) => {
  const myInterestIds = new Set((await interestsFor(req.user.sub)).map((i) => i.id));
  const myProfile = await db.prepare('SELECT city FROM user_profiles WHERE user_id = ?').get(req.user.sub);
  const myTaste = await tastePrefsFor(req.user.sub);
  const myFavoriteFoods = new Set(myTaste.favoriteFoods.map((food) => food.toLowerCase()));
  const myDietaryNeeds = new Set(myTaste.dietaryNeeds.map((need) => need.toLowerCase()));

  const candidates = toCamelRows(
    await db
      .prepare(
        `SELECT u.id, u.name, p.age, p.city, p.bio, p.photo_url, p.verified FROM users u
         JOIN user_profiles p ON p.user_id = u.id
         WHERE u.id != ? AND ${NOT_BLOCKED_CLAUSE} AND ${PROFILE_VISIBLE_CLAUSE}`,
      )
      .all(req.user.sub, req.user.sub, req.user.sub),
  );
  const premiumIds = await activePremiumUserIds(candidates.map((c) => c.id));

  const matches = (
    await Promise.all(
      candidates.map(async (candidate) => {
        const candidateInterests = await interestsFor(candidate.id);
        const sharedInterests = candidateInterests.filter((i) => myInterestIds.has(i.id));
        const sameCity = myProfile?.city && myProfile.city === candidate.city;

        // "Taste" match: favorite Pakistani dishes/cuisines and dietary
        // needs someone actually set in Food/Dietary Preferences (see
        // food-preferences.page.ts, dietary-preferences.page.ts) --
        // real signal from the same vocabulary restaurants use
        // (cuisine_tags), not just shared hobby interests.
        const candidateTaste = await tastePrefsFor(candidate.id);
        const sharedFavoriteFoods = candidateTaste.favoriteFoods.filter((food) => myFavoriteFoods.has(food.toLowerCase()));
        const sharedDietaryNeeds = candidateTaste.dietaryNeeds.filter((need) => myDietaryNeeds.has(need.toLowerCase()));
        const sameSpiceTolerance =
          myTaste.spiceTolerance && myTaste.spiceTolerance === candidateTaste.spiceTolerance;

        // Food/taste dominates the score -- interests are a smaller
        // tiebreaker on top of it, not an equal factor. Area is
        // deliberately NOT part of this score: it's applied afterward as a
        // same-city-first grouping instead (see the sort below), so it
        // never lets a distant stranger who shares your city outrank a
        // genuinely taste-matched person from elsewhere within their group.
        const score =
          sharedFavoriteFoods.length * 25 +
          sharedDietaryNeeds.length * 15 +
          (sameSpiceTolerance ? 10 : 0) +
          sharedInterests.length * 5;

        const reasons = [];
        if (sharedFavoriteFoods.length > 0) {
          reasons.push(`Also loves ${sharedFavoriteFoods[0]}`);
        }
        if (sharedDietaryNeeds.length > 0) {
          reasons.push(`Both ${sharedDietaryNeeds[0].toLowerCase()}`);
        }
        if (sameSpiceTolerance) {
          reasons.push(`Same spice tolerance (${candidateTaste.spiceTolerance})`);
        }
        if (sharedInterests.length > 0) {
          reasons.push(`Shares your interest in ${sharedInterests[0].name}`);
        }
        if (sameCity) {
          reasons.push(`Also based in ${candidate.city}`);
        }

        return {
          ...candidate,
          score: Math.min(score, 99),
          sameCity: !!sameCity,
          isPremium: premiumIds.has(candidate.id),
          interests: candidateInterests,
          sharedInterests,
          sharedFavoriteFoods,
          reasons,
          rating: await peopleRating(candidate.id),
          tablesJoinedCount: await tablesJoinedCount(candidate.id),
        };
      }),
    )
  ).sort((a, b) => {
    // Same-area people first as a whole group (top), everyone else after
    // (bottom). Priority profile placement (premium perk) breaks ties within
    // each area group next, ahead of the taste/interest score -- a premium
    // profile never jumps ahead of a genuinely closer/tastier match from the
    // other area group, but does rank above an equally-relevant free one.
    if (a.sameCity !== b.sameCity) return a.sameCity ? -1 : 1;
    if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1;
    return b.score - a.score;
  });

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
