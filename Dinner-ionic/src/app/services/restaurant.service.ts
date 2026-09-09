import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  /** Null for a restaurant that hasn't been geocoded -- see
   * Backend/scripts/geocode-restaurants.mjs. */
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  /** Up to 3 popular dishes; present on list results, absent elsewhere unless requested. */
  dishes?: Dish[];
}

export interface RestaurantDetail extends Restaurant {
  dishes: Dish[];
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
    return this.http.get<{ restaurants: Restaurant[] }>(this.baseUrl, { params: httpParams });
  }

  get(id: number | string): Observable<{ restaurant: RestaurantDetail }> {
    return this.http.get<{ restaurant: RestaurantDetail }>(`${this.baseUrl}/${id}`);
  }

  recommended(): Observable<{ restaurants: RestaurantDetail[] }> {
    return this.http.get<{ restaurants: RestaurantDetail[] }>(`${this.baseUrl}/recommended`);
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
}
