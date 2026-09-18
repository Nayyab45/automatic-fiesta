import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FollowedUser {
  id: number;
  name: string;
  photoUrl: string | null;
  city: string | null;
}

// Separate from FriendsService: following is one-way and needs no
// acceptance, unlike a friendship (see Backend/src/routes/friends.js's
// followsRouter).
@Injectable({ providedIn: 'root' })
export class FollowService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/follows`;

  status(userId: number): Observable<{ following: boolean }> {
    return this.http.get<{ following: boolean }>(`${this.baseUrl}/status/${userId}`);
  }

  follow(userId: number): Observable<{ following: boolean }> {
    return this.http.post<{ following: boolean }>(`${this.baseUrl}/${userId}`, {});
  }

  unfollow(userId: number): Observable<{ following: boolean }> {
    return this.http.delete<{ following: boolean }>(`${this.baseUrl}/${userId}`);
  }

  followers(): Observable<{ followers: FollowedUser[] }> {
    return this.http.get<{ followers: FollowedUser[] }>(`${this.baseUrl}/followers`);
  }

  following(): Observable<{ following: FollowedUser[] }> {
    return this.http.get<{ following: FollowedUser[] }>(`${this.baseUrl}/following`);
  }
}
