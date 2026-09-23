import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PolicyContent, PolicySlug } from '../shared/policy-content';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/content`;

  /** Public. `content` is always null -- callers show the built-in default. */
  get(slug: PolicySlug): Observable<{ content: PolicyContent | null; updatedAt: string | null }> {
    return this.http.get<{ content: PolicyContent | null; updatedAt: string | null }>(`${this.baseUrl}/${slug}`);
  }
}
