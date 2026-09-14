import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

// A city not yet cached can trigger a live OpenStreetMap import server-side
// (see Backend/src/lib/osmPlaces.js), which itself now times out -- but this
// caps it from the client side too, so a slow/unreachable backend can never
// leave a page's "loading" state spinning forever regardless of the cause.
const REQUEST_TIMEOUT_MS = 20000;

export interface Dish {
  id: number;
  restaurantId: number;
  name: string;
  price: number | null;
  description: string | null;
  photoUrl: string | null;
  rating: number | null;
  isPopular: number;
  isFeatured: number;
}

export interface FeaturedDish extends Dish {
  restaurantName: string;
}

export interface Restaurant {
  id: number;
  name: string;
  city: string;
  region: string;
  cuisineTags: string;
  /** Null for a real place imported from OpenStreetMap -- no fabricated price/rating. */
  priceTier: number | null;
  rating: number | null;
  reviewCount: number | null;
  description: string | null;
  address: string | null;
  photoUrl: string | null;
  /** Credit line for photoUrl when it's Creative Commons-licensed (from
   * Openverse -- see Backend/src/lib/restaurantPhotos.js); most CC licenses
   * require this be shown alongside the photo. Null for the app's own
   * curated seed photos, which don't need it. */
  photoAttribution: string | null;
  /** Null for a restaurant that hasn't been geocoded -- see
   * Backend/scripts/geocode-restaurants.mjs. */
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  /** Up to 3 popular dishes; present on list results, absent elsewhere unless requested. */
  dishes?: Dish[];
  /** Only present on /recommended results: distance from the coordinates passed to recommended(), if any were. */
  distanceKm?: number | null;
  /** Only present on /recommended results: this restaurant's cuisine tags that matched the user's Food Preferences. */
  matchedFoods?: string[];
  /** Only present on /recommended results: server-generated reasons this restaurant was picked, in priority order. */
  reasons?: string[];
}

export interface RestaurantDetail extends Restaurant {
  dishes: Dish[];
}

// Builds a link to the Google Maps app/website instead of rendering any
// in-app map -- prefers coordinates (drops the user straight into turn-by-
// turn directions) and falls back to a text search by address, then name,
// for a restaurant that hasn't been geocoded yet.
export function googleMapsUrl(place: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  name?: string | null;
}): string {
  if (place.latitude != null && place.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address || place.name || '')}`;
}

export interface RestaurantReview {
  id: number;
  restaurantId: number;
  reviewerUserId: number;
  reviewerName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantSearchParams {
  city?: string;
  region?: string;
  cuisine?: string;
  priceTier?: number;
  minRating?: number;
  query?: string;
}

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/restaurants`;

  list(params: RestaurantSearchParams = {}): Observable<{ restaurants: Restaurant[] }> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value);
      }
    }
    return this.http.get<{ restaurants: Restaurant[] }>(this.baseUrl, { params: httpParams }).pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  cuisines(city?: string): Observable<{ cuisines: string[] }> {
    let httpParams = new HttpParams();
    if (city) httpParams = httpParams.set('city', city);
    return this.http
      .get<{ cuisines: string[] }>(`${this.baseUrl}/cuisines`, { params: httpParams })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  get(id: number | string): Observable<{ restaurant: RestaurantDetail }> {
    return this.http.get<{ restaurant: RestaurantDetail }>(`${this.baseUrl}/${id}`);
  }

  recommended(coords?: { lat: number; lng: number }): Observable<{ restaurants: RestaurantDetail[] }> {
    let httpParams = new HttpParams();
    if (coords) {
      httpParams = httpParams.set('lat', coords.lat).set('lng', coords.lng);
    }
    return this.http.get<{ restaurants: RestaurantDetail[] }>(`${this.baseUrl}/recommended`, { params: httpParams });
  }

  featuredDishes(): Observable<{ dishes: FeaturedDish[] }> {
    return this.http.get<{ dishes: FeaturedDish[] }>(`${this.baseUrl}/featured-dishes`);
  }

  saved(): Observable<{ restaurants: Restaurant[] }> {
    return this.http.get<{ restaurants: Restaurant[] }>(`${this.baseUrl}/saved`);
  }

  save(id: number | string): Observable<{ saved: boolean }> {
    return this.http.post<{ saved: boolean }>(`${this.baseUrl}/${id}/save`, {});
  }

  unsave(id: number | string): Observable<{ saved: boolean }> {
    return this.http.delete<{ saved: boolean }>(`${this.baseUrl}/${id}/save`);
  }

  reviews(id: number | string): Observable<{ reviews: RestaurantReview[] }> {
    return this.http.get<{ reviews: RestaurantReview[] }>(`${this.baseUrl}/${id}/reviews`);
  }

  /** Posting again (same user, same restaurant) edits the existing review rather than erroring. */
  submitReview(id: number | string, payload: { rating: number; comment?: string }): Observable<{ review: RestaurantReview }> {
    return this.http.post<{ review: RestaurantReview }>(`${this.baseUrl}/${id}/reviews`, payload);
  }

  deleteReview(id: number | string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}/reviews`);
  }
}
