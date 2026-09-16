import { Injectable, computed, signal } from '@angular/core';
import { PAKISTAN_CITIES } from '../data/pakistan-cities';

export interface City {
  name: string;
  region: string;
}

const CURRENT_CITY_KEY = 'selectedCity';
const HOME_CITY_KEY = 'homeCity';

@Injectable({ providedIn: 'root' })
export class LocationService {
  readonly cities = PAKISTAN_CITIES;

  private readonly currentCity = signal<string>(this.loadInitial(CURRENT_CITY_KEY) ?? 'Karachi');
  readonly current = this.currentCity.asReadonly();

  // The city on the user's own profile -- their home base -- kept distinct
  // from `current` ("what city am I browsing right now"). Null means "not
  // known yet" (a fresh install, or an existing account that hasn't hit
  // profile-creation/profile.page since this was added), not "no home
  // city"; see syncHomeCityIfUnset.
  private readonly homeCityInternal = signal<string | null>(this.loadInitial(HOME_CITY_KEY));
  readonly homeCity = this.homeCityInternal.asReadonly();

  // True once a home city is known AND the browsing city has been
  // deliberately pointed somewhere else -- e.g. someone based in Multan
  // browsing Karachi to line up restaurants/people for an upcoming trip,
  // without that trip silently overwriting their actual home city.
  //
  // This is purely local, per-device state reflecting the *current signed-
  // in user's own* browsing choice -- it is never sent to or shown for any
  // other user's profile, only in the current user's own header/home
  // screens. Do not wire it into anything rendered on someone else's
  // profile (see profile.page.ts's isOwnProfile) -- broadcasting "this
  // person is away from home" to other users would be a real privacy/
  // safety issue in a social-dining app, not just a UX one.
  readonly isTraveling = computed(() => {
    const home = this.homeCityInternal();
    return home !== null && this.currentCity() !== home;
  });

  private loadInitial(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private persist(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* localStorage unavailable, nothing to persist */
    }
  }

  label(): string {
    return `${this.currentCity()}, PK`;
  }

  /** Changes only the city being browsed -- used by the Select Location
   * picker. Does not touch homeCity, so picking a different city here is
   * "traveling", not "I moved". */
  setCity(name: string): void {
    this.currentCity.set(name);
    this.persist(CURRENT_CITY_KEY, name);
  }

  /** Called when the user actually sets/changes their profile's city
   * (profile creation, or Edit Profile) -- updates the home city and jumps
   * the browsing city to match it too, since telling the app "I live in
   * Multan" should be reflected immediately rather than read as travel. */
  setHomeCity(name: string): void {
    this.homeCityInternal.set(name);
    this.persist(HOME_CITY_KEY, name);
    this.setCity(name);
  }

  /** Backfills homeCity for an account whose profile city was set before
   * this existed, without disturbing whatever city is currently being
   * browsed (that may already be a deliberate "traveling" choice). A no-op
   * once homeCity is already known. */
  syncHomeCityIfUnset(name: string | null | undefined): void {
    if (!name || this.homeCityInternal() !== null) return;
    this.homeCityInternal.set(name);
    this.persist(HOME_CITY_KEY, name);
  }
}
