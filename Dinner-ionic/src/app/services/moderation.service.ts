import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FlaggedUser {
  userId: number;
  name: string;
  email: string;
  flaggedAt: string;
  /** How many distinct people have blocked them -- what actually triggered
   * the flag (see BLOCK_FLAG_THRESHOLD in Backend's safety.js). */
  blockCount: number;
  /** Context only, not part of the trigger -- reports carry a reason,
   * blocks don't, so they're kept as separate signals. */
  reportCount: number;
}

@Injectable({ providedIn: 'root' })
export class ModerationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/blocks/admin`;

  /** Admin-only (403 otherwise). */
  flagged(): Observable<{ flagged: FlaggedUser[] }> {
    return this.http.get<{ flagged: FlaggedUser[] }>(`${this.baseUrl}/flagged`);
  }

  dismiss(userId: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${userId}/dismiss`, {});
  }

  /** Permanently deletes the account -- irreversible. */
  deleteAccount(userId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${userId}`);
  }
}
