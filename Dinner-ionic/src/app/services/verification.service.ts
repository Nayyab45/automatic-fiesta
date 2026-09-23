import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VerificationStatus {
  status: 'not_started' | 'pending' | 'approved' | 'rejected';
  hasIdFront: boolean;
  hasIdBack: boolean;
  submittedAt: string | null;
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

  submit(): Observable<VerificationStatus> {
    return this.http.post<VerificationStatus>(`${this.baseUrl}/me/submit`, {});
  }
}
