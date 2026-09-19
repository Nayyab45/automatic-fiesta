import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PolicyContent, PolicySlug } from '../shared/policy-content';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/content`;

  /** Public. `content` is null until an admin has edited the page -- callers show the built-in default then. */
  get(slug: PolicySlug): Observable<{ content: PolicyContent | null; updatedAt: string | null }> {
    return this.http.get<{ content: PolicyContent | null; updatedAt: string | null }>(`${this.baseUrl}/${slug}`);
  }

  /** Admin-only. */
  save(slug: PolicySlug, content: PolicyContent): Observable<{ content: PolicyContent }> {
    return this.http.put<{ content: PolicyContent }>(`${this.baseUrl}/${slug}`, { content });
  }

  /** Admin-only -- deletes the edit so the built-in text shows again. */
  reset(slug: PolicySlug): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${slug}`);
  }
}
