import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

export interface FriendRequest {
  id: number;
  requesterId: number;
  name: string;
  photoUrl: string | null;
  createdAt: string;
}

export interface Friend {
  id: number;
  name: string;
  photoUrl: string | null;
  city: string | null;
}

@Injectable({ providedIn: 'root' })
export class FriendsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/friends`;

  status(userId: number): Observable<{ status: FriendStatus; requestId?: number }> {
    return this.http.get<{ status: FriendStatus; requestId?: number }>(`${this.baseUrl}/status/${userId}`);
  }

  list(): Observable<{ friends: Friend[] }> {
    return this.http.get<{ friends: Friend[] }>(this.baseUrl);
  }

  requests(): Observable<{ requests: FriendRequest[] }> {
    return this.http.get<{ requests: FriendRequest[] }>(`${this.baseUrl}/requests`);
  }

  send(recipientId: number): Observable<{ status: FriendStatus; requestId: number }> {
    return this.http.post<{ status: FriendStatus; requestId: number }>(`${this.baseUrl}/requests`, { recipientId });
  }

  accept(requestId: number): Observable<{ status: FriendStatus }> {
    return this.http.post<{ status: FriendStatus }>(`${this.baseUrl}/requests/${requestId}/accept`, {});
  }

  decline(requestId: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/requests/${requestId}/decline`, {});
  }

  unfriend(userId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${userId}`);
  }
}
