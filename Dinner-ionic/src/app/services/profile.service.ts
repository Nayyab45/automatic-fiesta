import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Interest {
  id: number;
  name: string;
  category: string;
}

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
  verified: boolean;
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
  interests: Interest[];
}

export interface PreferenceChangeStatus {
  /** How many of the 2 monthly Edit Preferences saves are still available. */
  remaining: number;
  /** Date (YYYY-MM-DD) the monthly allowance resets -- always the 1st of next month. */
  nextResetAt: string;
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
  sharedInterests: Interest[];
  reasons: string[];
  rating: number | null;
  tablesJoinedCount: number;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/profile`;

  me(): Observable<{ profile: Profile; preferenceChanges: PreferenceChangeStatus }> {
    return this.http.get<{ profile: Profile; preferenceChanges: PreferenceChangeStatus }>(`${this.baseUrl}/me`);
  }

  get(id: number | string): Observable<{ profile: Profile }> {
    return this.http.get<{ profile: Profile }>(`${this.baseUrl}/${id}`);
  }

  updateMe(payload: { age?: number; bio?: string; city?: string; province?: string; photoUrl?: string; phone?: string }): Observable<{ profile: Profile }> {
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

  people(city?: string): Observable<{ people: Person[] }> {
    let params = new HttpParams();
    if (city) params = params.set('city', city);
    return this.http.get<{ people: Person[] }>(`${environment.apiUrl}/people`, { params });
  }

  matches(): Observable<{ matches: Match[] }> {
    return this.http.get<{ matches: Match[] }>(`${environment.apiUrl}/matches`);
  }

  privacySettings(): Observable<{ settings: PrivacySettings }> {
    return this.http.get<{ settings: PrivacySettings }>(`${this.baseUrl}/me/privacy-settings`);
  }

  updatePrivacySettings(payload: Partial<PrivacySettings>): Observable<{ settings: PrivacySettings }> {
    return this.http.put<{ settings: PrivacySettings }>(`${this.baseUrl}/me/privacy-settings`, payload);
  }
}
