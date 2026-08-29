import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EmergencyContact {
  id: number;
  name: string;
  relationship: string | null;
  phone: string;
  email: string | null;
  notifyOnCheckin: number;
  notifyOnNoCheckout: number;
  createdAt: string;
}

export interface EmergencyContactPayload {
  name: string;
  relationship?: string;
  phone: string;
  email?: string;
  notifyOnCheckin?: boolean;
  notifyOnNoCheckout?: boolean;
}

export interface BlockedUser {
  userId: number;
  name: string;
  photoUrl: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SafetyService {
  private readonly http = inject(HttpClient);

  emergencyContacts(): Observable<{ contacts: EmergencyContact[] }> {
    return this.http.get<{ contacts: EmergencyContact[] }>(`${environment.apiUrl}/emergency-contacts`);
  }

  addEmergencyContact(payload: EmergencyContactPayload): Observable<{ contact: EmergencyContact }> {
    return this.http.post<{ contact: EmergencyContact }>(`${environment.apiUrl}/emergency-contacts`, payload);
  }

  removeEmergencyContact(id: number | string): Observable<unknown> {
    return this.http.delete(`${environment.apiUrl}/emergency-contacts/${id}`);
  }

  blockedUsers(): Observable<{ blocked: BlockedUser[] }> {
    return this.http.get<{ blocked: BlockedUser[] }>(`${environment.apiUrl}/blocks`);
  }

  block(userId: number | string): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/blocks`, { userId });
  }

  unblock(userId: number | string): Observable<unknown> {
    return this.http.delete(`${environment.apiUrl}/blocks/${userId}`);
  }

  report(reportedUserId: number | string, reason: string, details?: string, alsoBlock?: boolean): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/reports`, { reportedUserId, reason, details, alsoBlock });
  }
}
