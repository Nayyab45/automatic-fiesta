import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SupportMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/support`;

  submit(subject: string, message: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}`, { subject, message });
  }

  /** Admin-only (403 otherwise). */
  list(): Observable<{ messages: SupportMessage[] }> {
    return this.http.get<{ messages: SupportMessage[] }>(`${this.baseUrl}/admin`);
  }

  resolve(id: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/admin/${id}/resolve`, {});
  }
}
