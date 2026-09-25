import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamel, toCamelRows } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { tastePrefsFor, distanceKm } from '../lib/taste.js';
import { cityCoordinates } from '../lib/cityGeocode.js';
import { tableCreationStatus } from './tables.js';
import { explainMatch } from '../lib/ai.js';

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
  showProfileViews: true,
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

// Batched "will this candidate show mutual interests to the viewer" check
// for Discover People, same batching reasoning as interestsForBatch --
// a row missing from privacy_settings defaults to visible, matching
// DEFAULT_PRIVACY_SETTINGS above.
async function mutualInterestsVisibilityForBatch(userIds) {
  const byUserId = new Map(userIds.map((id) => [id, DEFAULT_PRIVACY_SETTINGS.showMutualInterests]));
  if (!userIds.length) return byUserId;
  const placeholders = userIds.map(() => '?').join(',');
  const rows = await db
    .prepare(`SELECT user_id, show_mutual_interests FROM privacy_settings WHERE user_id IN (${placeholders})`)
    .all(...userIds);
  for (const row of rows) {
    byUserId.set(row.user_id, !!row.show_mutual_interests);
  }
  return byUserId;
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
//
// Counts distinct viewers, not raw visits: profile_views has one row per
// (viewer, viewed) pair (see recordProfileView), so someone re-opening your
// profile 5 times still only counts once here.
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

// Written reviews this person has received as a dining companion (see
// tablesRouter's /:id/rate) -- public on their profile alongside the
// aggregate star rating peopleRating() already shows. Comment-only rows are
// skipped since a bare score with nothing written isn't a "review" to read.
profileRouter.get('/:id/reviews', asyncHandler(async (req, res) => {
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const rows = toCamelRows(
    await db
      .prepare(
        `SELECT r.id, r.score, r.comment, r.created_at, u.id as rater_user_id, u.name as rater_name,
                p.photo_url as rater_photo_url, t.id as table_id, t.title as table_title
         FROM user_ratings r
         JOIN users u ON u.id = r.rater_user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
         JOIN dining_tables t ON t.id = r.table_id
         WHERE r.rated_user_id = ? AND r.comment IS NOT NULL AND r.comment != ''
         ORDER BY r.created_at DESC
         LIMIT 50`,
      )
      .all(req.params.id),
  );
  res.json({ reviews: rows });
}));

// Always recorded regardless of the visitor's own privacy choices, and never
// for a self-view. One row per (viewer, viewed) pair -- re-visiting just
// bumps viewed_at instead of piling up duplicates, so both the "who viewed
// you" identity list (GET /me/viewers below) and profileViewsCount() above
// treat repeat views from the same person as a single view.
async function recordProfileView(viewerUserId, viewedUserId) {
  if (viewerUserId === viewedUserId) return;
  await db.prepare(
    `INSERT INTO profile_views (viewer_user_id, viewed_user_id, viewed_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE viewed_at = NOW()`,
  ).run(viewerUserId, viewedUserId);
}

// Who has viewed my profile recently (most recent first) -- viewers who
// opted OUT via "show my profile views" (default on) are left out of this
// identity list; the count above still includes everyone regardless. The
// COALESCE fallback here must track DEFAULT_PRIVACY_SETTINGS.showProfileViews
// above -- a viewer with no privacy_settings row gets that default, not a
// hardcoded value that can drift out of sync with it.
profileRouter.get('/me/viewers', asyncHandler(async (req, res) => {
  const rows = toCamelRows(
    await db
      .prepare(
        `SELECT u.id, u.name, p.photo_url, p.verified, pv.viewed_at FROM profile_views pv
         JOIN users u ON u.id = pv.viewer_user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN privacy_settings ps ON ps.user_id = pv.viewer_user_id
         WHERE pv.viewed_user_id = ? AND COALESCE(ps.show_profile_views, 1) = 1
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
  const [interestsByUserId, favoriteFoodsByUserId, mutualVisibilityByUserId] = await Promise.all([
    interestsForBatch(ids),
    favoriteFoodsForBatch(ids),
    mutualInterestsVisibilityForBatch(ids),
  ]);
  // Mutual interests: the overlap between the viewer's own interests and
  // each candidate's, so "3 mutual interests" means something real rather
  // than just echoing the candidate's full interest list back. Hidden
  // (empty) for a candidate who's turned off "Show mutual interests" in
  // their own Privacy Settings, same toggle Edit Preferences already writes.
  const myInterestIds = new Set((await interestsFor(req.user.sub)).map((interest) => interest.id));
  people = people.map((person) => {
    const interests = interestsByUserId.get(person.id) ?? [];
    return {
      ...person,
      interests,
      favoriteFoods: favoriteFoodsByUserId.get(person.id) ?? [],
      sharedInterests: mutualVisibilityByUserId.get(person.id)
        ? interests.filter((interest) => myInterestIds.has(interest.id))
        : [],
    };
  });

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

  const followedIds = new Set(
    (await db.prepare('SELECT followed_user_id FROM user_follows WHERE follower_user_id = ?').all(req.user.sub)).map(
      (row) => row.followed_user_id,
    ),
  );

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
          interests: candidateInterests,
          sharedInterests,
          sharedFavoriteFoods,
          sharedDietaryNeeds,
          spiceTolerance: sameSpiceTolerance ? candidateTaste.spiceTolerance : null,
          reasons,
          rating: await peopleRating(candidate.id),
          tablesJoinedCount: await tablesJoinedCount(candidate.id),
          following: followedIds.has(candidate.id),
          // Flipped true below only for a match that actually got an
          // AI-written reason -- lets the frontend show which ones are
          // AI-powered without a second round trip.
          aiPowered: false,
        };
      }),
    )
  ).sort((a, b) => {
    // Same-area people first as a whole group (top), everyone else after
    // (bottom), then by the taste/interest score.
    if (a.sameCity !== b.sameCity) return a.sameCity ? -1 : 1;
    return b.score - a.score;
  });

  {
    // AI-write the top reason for only the highest-ranked matches -- capped
    // at 5 (confirmed live: Gemini's free tier allows exactly 5
    // generateContent calls/minute per model, see ai.js) so one page load
    // can't blow through the whole minute's quota by itself. Falls back to
    // the heuristic reasons above untouched (see ai.js) when no key is
    // configured, a call 429s, or there's nothing to explain in the first
    // place -- so exceeding this cap degrades to the plain heuristic for
    // the rest, never breaks the page.
    const AI_EXPLAINED_MATCHES = 5;
    await Promise.all(
      matches.slice(0, AI_EXPLAINED_MATCHES).map(async (match) => {
        const aiReason = await explainMatch({
          candidateName: match.name,
          sharedFavoriteFoods: match.sharedFavoriteFoods,
          sharedDietaryNeeds: match.sharedDietaryNeeds,
          sameSpiceTolerance: !!match.spiceTolerance,
          spiceTolerance: match.spiceTolerance,
          sharedInterests: match.sharedInterests.map((i) => i.name),
          sameCity: match.sameCity,
          city: match.city,
        });
        if (aiReason) {
          match.reasons = [aiReason, ...match.reasons];
          match.aiPowered = true;
        }
      }),
    );
  }

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
