import { Injectable, signal } from '@angular/core';

export interface City {
  name: string;
  region: string;
}

const STORAGE_KEY = 'selectedCity';

const CITIES: City[] = [
  { name: 'Karachi', region: 'Sindh' },
  { name: 'Lahore', region: 'Punjab' },
  { name: 'Islamabad', region: 'Federal Capital' },
  { name: 'Rawalpindi', region: 'Punjab' },
  { name: 'Faisalabad', region: 'Punjab' },
  { name: 'Peshawar', region: 'Khyber Pakhtunkhwa' },
  { name: 'Multan', region: 'Punjab' },
  { name: 'Quetta', region: 'Balochistan' },
];

@Injectable({ providedIn: 'root' })
export class LocationService {
  readonly cities = CITIES;

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
