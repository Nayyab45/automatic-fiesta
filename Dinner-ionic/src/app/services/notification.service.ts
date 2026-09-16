import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppNotification {
  id: number;
  type: string;
  message: string;
  tableId: number | null;
  actorName: string | null;
  actorUserId: number | null;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notifications`;

  list(): Observable<{ notifications: AppNotification[] }> {
    return this.http.get<{ notifications: AppNotification[] }>(this.baseUrl);
  }

  markAllRead(): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/read-all`, {});
  }

  markRead(id: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${id}/read`, {});
  }

  registerDeviceToken(token: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/device-token`, { token });
  }

  unregisterDeviceToken(token: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/device-token`, { body: { token } });
  }
}
