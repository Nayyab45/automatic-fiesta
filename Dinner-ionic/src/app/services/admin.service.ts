import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// All admin-only (403 for anyone else) -- see the `/admin` sub-routes in
// Backend's auth.js, tables.js and restaurants.js. Existing admin screens
// (verifications, moderation, support) keep their own small services.

export interface AdminStats {
  totalUsers: number;
  totalRestaurants: number;
  totalEvents: number;
  activeEvents: number;
  pendingVerifications: number;
  flaggedUsers: number;
  suspendedUsers: number;
  openSupportTickets: number;
  totalReports: number;
}

export type AdminUserStatusFilter = '' | 'suspended' | 'flagged' | 'unverified' | 'admin';

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  suspendedAt: string | null;
  flaggedAt: string | null;
  verified: boolean;
  isPremium: boolean;
}

export interface AdminUserDetail {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  flaggedAt: string | null;
  age: number | null;
  city: string | null;
  bio: string | null;
  photoUrl: string | null;
  gender: string | null;
  verified: boolean;
  isPremium: boolean;
  verificationStatus: string;
  verificationSubmittedAt: string | null;
  rating: number | null;
  blockCount: number;
  reportCount: number;
  tablesJoinedCount: number;
}

export interface AdminUserReport {
  id: number;
  reason: string;
  details: string | null;
  createdAt: string;
  reporterName: string;
}

export interface AdminTable {
  id: number;
  title: string;
  hostUserId: number;
  hostName: string;
  restaurantName: string;
  gatheringType: string;
  dateTime: string;
  seatsTotal: number;
  visibility: string;
  audience: string;
  createdAt: string;
}

export interface AdminRestaurant {
  id: number;
  name: string;
  city: string;
  region: string;
  cuisineTags: string;
  priceTier: number | null;
  rating: number | null;
  reviewCount: number | null;
  address: string | null;
  source: string;
  createdAt: string;
}

/** Fields the admin restaurant form edits (create and update share them). */
export interface AdminRestaurantPayload {
  name: string;
  city: string;
  region?: string;
  cuisineTags: string;
  priceTier?: number | null;
  description?: string;
  address?: string;
  photoUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
}

export interface AdminRestaurantReview {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewerName: string;
  restaurantName: string;
}

export interface AdminTableReview {
  id: number;
  tableId: number;
  tableTitle: string;
  reviewerName: string;
  overallRating: number | null;
  comment: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  stats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.api}/auth/admin/stats`);
  }

  users(search: string, status: AdminUserStatusFilter): Observable<{ users: AdminUserRow[] }> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    return this.http.get<{ users: AdminUserRow[] }>(`${this.api}/auth/admin/users`, { params });
  }

  user(id: number | string): Observable<{ user: AdminUserDetail }> {
    return this.http.get<{ user: AdminUserDetail }>(`${this.api}/auth/admin/users/${id}`);
  }

  userReports(id: number | string): Observable<{ reports: AdminUserReport[] }> {
    return this.http.get<{ reports: AdminUserReport[] }>(`${this.api}/auth/admin/users/${id}/reports`);
  }

  suspend(id: number | string, reason: string): Observable<unknown> {
    return this.http.post(`${this.api}/auth/admin/users/${id}/suspend`, { reason });
  }

  unsuspend(id: number | string): Observable<unknown> {
    return this.http.post(`${this.api}/auth/admin/users/${id}/unsuspend`, {});
  }

  tables(): Observable<{ tables: AdminTable[] }> {
    return this.http.get<{ tables: AdminTable[] }>(`${this.api}/tables/admin`);
  }

  deleteTable(id: number): Observable<unknown> {
    return this.http.delete(`${this.api}/tables/admin/${id}`);
  }

  restaurants(search: string): Observable<{ restaurants: AdminRestaurant[] }> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<{ restaurants: AdminRestaurant[] }>(`${this.api}/restaurants/admin`, { params });
  }

  createRestaurant(payload: AdminRestaurantPayload): Observable<unknown> {
    return this.http.post(`${this.api}/restaurants/admin`, payload);
  }

  updateRestaurant(id: number, payload: AdminRestaurantPayload): Observable<unknown> {
    return this.http.put(`${this.api}/restaurants/admin/${id}`, payload);
  }

  deleteRestaurant(id: number): Observable<unknown> {
    return this.http.delete(`${this.api}/restaurants/admin/${id}`);
  }

  restaurantReviews(): Observable<{ reviews: AdminRestaurantReview[] }> {
    return this.http.get<{ reviews: AdminRestaurantReview[] }>(`${this.api}/restaurants/admin/reviews`);
  }

  deleteRestaurantReview(id: number): Observable<unknown> {
    return this.http.delete(`${this.api}/restaurants/admin/reviews/${id}`);
  }

  tableReviews(): Observable<{ reviews: AdminTableReview[] }> {
    return this.http.get<{ reviews: AdminTableReview[] }>(`${this.api}/tables/admin/reviews`);
  }

  deleteTableReview(id: number): Observable<unknown> {
    return this.http.delete(`${this.api}/tables/admin/reviews/${id}`);
  }
}
