import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Interest {
  id: number;
  name: string;
  category: string;
}

/** 'woman' is the only value that ever gates anything (a women-only table's
 * eligibility -- see Backend/src/routes/tables.js); the rest are stored only
 * to show back on the profile. */
export type Gender = 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say';

export interface Profile {
  id: number;
  name: string;
  email: string;
  age: number | null;
  bio: string | null;
  city: string | null;
  province: string | null;
  photoUrl: string | null;
  phone: string | null;
  gender: Gender | null;
  verified: boolean;
  isPremium: boolean;
  tablesJoinedCount: number;
  rating: number | null;
  favoriteFoods: string[];
  dietaryNeeds: string[];
  spiceTolerance: string | null;
  maxDistanceKm: number | null;
  diningTimes: string[];
  interests: Interest[];
}

export interface Person {
  id: number;
  name: string;
  age: number | null;
  city: string | null;
  bio: string | null;
  photoUrl: string | null;
  verified: number;
  /** Priority profile placement (premium perk) -- premium people sort first
   * in Discover People/Matches, and get a badge wherever they're shown. */
  isPremium: boolean;
  interests: Interest[];
  /** Overlap between the viewer's own interests and this person's -- empty
   * if there's no overlap, or if this person has turned off "Show mutual
   * interests" in their Privacy Settings. */
  sharedInterests: Interest[];
  /** Only present when the distance filter was used -- km from the
   * coordinates passed to people(), to this person's self-reported city. */
  distanceKm?: number | null;
}

export interface PeopleFilters {
  city?: string;
  minAge?: number;
  maxAge?: number;
  /** Interest/Cuisine/Distance are "advanced" filters (a Premium perk, see
   * proposal's Revenue Model) -- silently ignored server-side for a free
   * account (see peopleRouter in profile.js), so gate the UI that lets a
   * free account set these too rather than relying on the backend alone. */
  interestIds?: number[];
  cuisine?: string[];
  /** Both required together with maxDistanceKm -- the viewer's own live
   * coordinates, sent fresh on every request and never stored (see
   * Backend/src/routes/profile.js). */
  lat?: number;
  lng?: number;
  maxDistanceKm?: number;
}

export interface PreferenceChangeStatus {
  /** How many of the 2 monthly Edit Preferences saves are still available. */
  remaining: number;
  /** Date (YYYY-MM-DD) the monthly allowance resets -- always the 1st of next month. */
  nextResetAt: string;
}

export interface TableCreationStatus {
  /** True for an active Premium subscription -- remaining/nextResetAt are
   * both null in that case, there's nothing to count down. */
  unlimited: boolean;
  remaining: number | null;
  nextResetAt: string | null;
}

export interface Viewer {
  id: number;
  name: string;
  photoUrl: string | null;
  verified: number;
  viewedAt: string;
}

export interface PrivacySettings {
  profileVisible: boolean;
  showMutualInterests: boolean;
  showOnlineStatus: boolean;
  showProfileViews: boolean;
  locationPrecision: 'approximate' | 'exact';
}

export interface Match extends Person {
  score: number;
  /** Whether this person is in the same city as you -- matches are grouped same-city-first, ranked by score within each group. */
  sameCity: boolean;
  sharedInterests: Interest[];
  /** Favorite foods (from Food Preferences) this person shares with you -- same vocabulary as restaurant cuisine tags. */
  sharedFavoriteFoods: string[];
  reasons: string[];
  /** True when reasons[0] was AI-written rather than the plain heuristic --
   * only ever true when the response's aiInsightsUnlocked (a Premium perk) is true. */
  aiPowered: boolean;
  rating: number | null;
  tablesJoinedCount: number;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/profile`;

  me(): Observable<{
    profile: Profile;
    preferenceChanges: PreferenceChangeStatus;
    tableCreation: TableCreationStatus;
    profileViewsCount: number;
    isAdmin: boolean;
  }> {
    return this.http.get<{
      profile: Profile;
      preferenceChanges: PreferenceChangeStatus;
      tableCreation: TableCreationStatus;
      profileViewsCount: number;
      isAdmin: boolean;
    }>(`${this.baseUrl}/me`);
  }

  /** Premium-only -- 402s for a free account, same shape as other
   * subscription-gated endpoints (see SubscriptionService/payment flow). */
  viewers(): Observable<{ viewers: Viewer[] }> {
    return this.http.get<{ viewers: Viewer[] }>(`${this.baseUrl}/me/viewers`);
  }

  get(id: number | string): Observable<{ profile: Profile }> {
    return this.http.get<{ profile: Profile }>(`${this.baseUrl}/${id}`);
  }

  updateMe(payload: { age?: number; bio?: string; city?: string; province?: string; photoUrl?: string; phone?: string; gender?: Gender }): Observable<{ profile: Profile }> {
    return this.http.put<{ profile: Profile }>(`${this.baseUrl}/me`, payload);
  }

  setInterests(interestIds: number[]): Observable<{ interests: Interest[] }> {
    return this.http.put<{ interests: Interest[] }>(`${this.baseUrl}/me/interests`, { interestIds });
  }

  setFoodPreferences(favoriteFoods: string[]): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/me/food-preferences`, { favoriteFoods });
  }

  setDietaryPreferences(needs: string[], spiceTolerance: string): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/me/dietary-preferences`, { needs, spiceTolerance });
  }

  setMatchPreferences(maxDistanceKm: number, diningTimes: string[]): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/me/match-preferences`, { maxDistanceKm, diningTimes });
  }

  /** Used only by the Edit Preferences page -- capped at 2 calls/month server-side (429 once used up). */
  updatePreferences(payload: {
    favoriteFoods: string[];
    needs: string[];
    spiceTolerance: string;
    maxDistanceKm: number;
    diningTimes: string[];
  }): Observable<{ profile: Profile; preferenceChanges: PreferenceChangeStatus }> {
    return this.http.put<{ profile: Profile; preferenceChanges: PreferenceChangeStatus }>(`${this.baseUrl}/me/preferences`, payload);
  }

  interests(): Observable<{ interests: Interest[] }> {
    return this.http.get<{ interests: Interest[] }>(`${environment.apiUrl}/interests`);
  }

  people(filters: PeopleFilters = {}): Observable<{ people: Person[]; advancedFiltersUnlocked: boolean }> {
    let params = new HttpParams();
    if (filters.city) params = params.set('city', filters.city);
    if (filters.minAge) params = params.set('minAge', filters.minAge);
    if (filters.maxAge) params = params.set('maxAge', filters.maxAge);
    if (filters.interestIds?.length) params = params.set('interestIds', filters.interestIds.join(','));
    if (filters.cuisine?.length) params = params.set('cuisine', filters.cuisine.join(','));
    if (filters.lat !== undefined && filters.lng !== undefined && filters.maxDistanceKm) {
      params = params.set('lat', filters.lat).set('lng', filters.lng).set('maxDistanceKm', filters.maxDistanceKm);
    }
    return this.http.get<{ people: Person[]; advancedFiltersUnlocked: boolean }>(`${environment.apiUrl}/people`, { params });
  }

  matches(): Observable<{ matches: Match[]; aiInsightsUnlocked: boolean }> {
    return this.http.get<{ matches: Match[]; aiInsightsUnlocked: boolean }>(`${environment.apiUrl}/matches`);
  }

  privacySettings(): Observable<{ settings: PrivacySettings }> {
    return this.http.get<{ settings: PrivacySettings }>(`${this.baseUrl}/me/privacy-settings`);
  }

  updatePrivacySettings(payload: Partial<PrivacySettings>): Observable<{ settings: PrivacySettings }> {
    return this.http.put<{ settings: PrivacySettings }>(`${this.baseUrl}/me/privacy-settings`, payload);
  }
}
