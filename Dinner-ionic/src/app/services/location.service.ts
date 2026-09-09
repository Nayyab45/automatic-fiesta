import { Injectable, signal } from '@angular/core';
import { PAKISTAN_CITIES } from '../data/pakistan-cities';

export interface City {
  name: string;
  region: string;
}

const STORAGE_KEY = 'selectedCity';

@Injectable({ providedIn: 'root' })
export class LocationService {
  readonly cities = PAKISTAN_CITIES;

  private readonly currentCity = signal<string>(this.loadInitial());
  readonly current = this.currentCity.asReadonly();

  private loadInitial(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'Karachi';
    } catch {
      return 'Karachi';
    }
  }

  label(): string {
    return `${this.currentCity()}, PK`;
  }

  setCity(name: string): void {
    this.currentCity.set(name);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* localStorage unavailable, nothing to persist */
    }
  }
}
