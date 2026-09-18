import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VerificationStatus {
  status: 'not_started' | 'pending' | 'approved' | 'rejected';
  hasIdFront: boolean;
  hasIdBack: boolean;
  hasSelfie: boolean;
  submittedAt: string | null;
  /** The automated selfie/ID match score (0-100) from the most recent
   * submission -- see Backend's faceMatch.js. Null if that check never ran
   * (not configured server-side, or no submission yet). */
  faceMatchConfidence: number | null;
}

export interface PendingVerification {
  userId: number;
  name: string;
  email: string;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  submittedAt: string;
}

@Injectable({ providedIn: 'root' })
export class VerificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/verification`;

  status(): Observable<VerificationStatus> {
    return this.http.get<VerificationStatus>(`${this.baseUrl}/me`);
  }

  saveId(idFrontUrl: string, idBackUrl: string): Observable<VerificationStatus> {
    return this.http.put<VerificationStatus>(`${this.baseUrl}/me/id`, { idFrontUrl, idBackUrl });
  }

  saveSelfie(selfieUrl: string): Observable<VerificationStatus> {
    return this.http.put<VerificationStatus>(`${this.baseUrl}/me/selfie`, { selfieUrl });
  }

  submit(): Observable<VerificationStatus> {
    return this.http.post<VerificationStatus>(`${this.baseUrl}/me/submit`, {});
  }

  /** Admin-only (403 otherwise) -- submissions Face++ couldn't auto-resolve. */
  pending(): Observable<{ submissions: PendingVerification[] }> {
    return this.http.get<{ submissions: PendingVerification[] }>(`${this.baseUrl}/admin/pending`);
  }

  decide(userId: number, status: 'approved' | 'rejected'): Observable<VerificationStatus> {
    return this.http.patch<VerificationStatus>(`${this.baseUrl}/admin/${userId}`, { status });
  }
}
