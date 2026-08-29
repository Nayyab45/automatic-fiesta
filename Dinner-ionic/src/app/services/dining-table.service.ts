import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TableRestaurantSummary {
  name: string;
  photoUrl: string | null;
  address: string | null;
  rating: number;
  cuisineTags: string;
}

export interface TableHost {
  id: number;
  name: string;
}

export interface DiningTable {
  id: number;
  title: string;
  restaurantId: number;
  hostUserId: number;
  gatheringType: string;
  dateTime: string;
  seatsTotal: number;
  visibility: string;
  atmosphere: string | null;
  note: string | null;
  pricePerPerson: number | null;
  createdAt: string;
  restaurant: TableRestaurantSummary;
  host: TableHost;
  guestCount: number;
  isPast: boolean;
  isHost: boolean;
  hasReviewed: boolean;
}

export interface TableGuest {
  id: number;
  name: string;
  role: string | null;
  isHost: boolean;
}

export interface SeatRequest {
  id: number;
  tableId: number;
  userId: number;
  status: 'sent' | 'confirmed' | 'declined';
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckIn {
  id: number;
  tableId: number;
  userId: number;
  checkedInAt: string;
  checkedOutAt: string | null;
}

export interface CreateTablePayload {
  restaurantId: number;
  title?: string;
  gatheringType: string;
  dateTime: string;
  seatsTotal: number;
  visibility?: string;
  atmosphere?: string;
  note?: string;
  pricePerPerson?: number;
}

export interface ReviewPayload {
  foodRating: number;
  restaurantRating: number;
  conversationRating: number;
  overallRating: number;
  dineAgain: string;
  comment: string;
}

export interface TableMessage {
  id: number;
  tableId: number;
  senderId: number;
  senderName: string;
  body: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class DiningTableService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tables`;

  listMine(): Observable<{ tables: DiningTable[] }> {
    return this.http.get<{ tables: DiningTable[] }>(`${this.baseUrl}?mine=true`);
  }

  get(id: number | string): Observable<{ table: DiningTable }> {
    return this.http.get<{ table: DiningTable }>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateTablePayload): Observable<{ table: DiningTable }> {
    return this.http.post<{ table: DiningTable }>(this.baseUrl, payload);
  }

  guests(id: number | string): Observable<{ guests: TableGuest[] }> {
    return this.http.get<{ guests: TableGuest[] }>(`${this.baseUrl}/${id}/guests`);
  }

  requestSeat(id: number | string, message?: string): Observable<{ seatRequest: SeatRequest }> {
    return this.http.post<{ seatRequest: SeatRequest }>(`${this.baseUrl}/${id}/seat-requests`, { message });
  }

  mySeatRequest(id: number | string): Observable<{ seatRequest: SeatRequest | null }> {
    return this.http.get<{ seatRequest: SeatRequest | null }>(`${this.baseUrl}/${id}/seat-requests/me`);
  }

  patchSeatRequest(requestId: number | string, status: 'confirmed' | 'declined'): Observable<{ seatRequest: SeatRequest }> {
    return this.http.patch<{ seatRequest: SeatRequest }>(`${environment.apiUrl}/seat-requests/${requestId}`, { status });
  }

  checkIn(id: number | string): Observable<{ checkIn: CheckIn }> {
    return this.http.post<{ checkIn: CheckIn }>(`${this.baseUrl}/${id}/check-in`, {});
  }

  checkOut(id: number | string): Observable<{ checkIn: CheckIn | null }> {
    return this.http.post<{ checkIn: CheckIn | null }>(`${this.baseUrl}/${id}/check-out`, {});
  }

  myCheckIn(id: number | string): Observable<{ checkIn: CheckIn | null }> {
    return this.http.get<{ checkIn: CheckIn | null }>(`${this.baseUrl}/${id}/check-in/me`);
  }

  submitReview(id: number | string, payload: ReviewPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${id}/reviews`, payload);
  }

  messages(id: number | string): Observable<{ messages: TableMessage[] }> {
    return this.http.get<{ messages: TableMessage[] }>(`${this.baseUrl}/${id}/messages`);
  }

  sendMessage(id: number | string, body: string): Observable<{ message: TableMessage }> {
    return this.http.post<{ message: TableMessage }>(`${this.baseUrl}/${id}/messages`, { body });
  }
}
