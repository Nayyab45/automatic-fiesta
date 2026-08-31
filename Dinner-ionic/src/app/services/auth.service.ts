import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { catchError, map, shareReplay, finalize } from 'rxjs/operators';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly currentUserSignal = signal<AuthUser | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  // @capacitor/preferences is Capacitor's cross-platform key/value store --
  // backed by SharedPreferences on Android rather than the WebView's
  // localStorage, and by localStorage under the hood on the web build (so
  // dev-in-browser behaves the same as before). Its API is async, but the
  // HTTP interceptor needs `token` synchronously on every request, so the
  // access token is mirrored in this in-memory field and only Preferences
  // itself is awaited -- once, at startup, via hydrate().
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshRequest$: Observable<string | null> | null = null;

  get token(): string | null {
    return this.accessToken;
  }

  /** Awaited by an APP_INITIALIZER before the router activates any route,
   * so guards see a correct signed-in state on cold start instead of a
   * flash of "logged out" while Preferences loads. */
  async hydrate(): Promise<void> {
    const [accessToken, refreshToken, userJson] = await Promise.all([
      Preferences.get({ key: ACCESS_TOKEN_KEY }),
      Preferences.get({ key: REFRESH_TOKEN_KEY }),
      Preferences.get({ key: USER_KEY }),
    ]);
    this.accessToken = accessToken.value;
    this.refreshToken = refreshToken.value;
    this.currentUserSignal.set(userJson.value ? (JSON.parse(userJson.value) as AuthUser) : null);
  }

  signup(name: string, email: string, password: string): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${this.baseUrl}/signup`, { name, email, password })
      .pipe(tap((session) => this.setSession(session)));
  }

  login(email: string, password: string): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${this.baseUrl}/login`, { email, password })
      .pipe(tap((session) => this.setSession(session)));
  }

  logout(): void {
    const refreshToken = this.refreshToken;
    this.clearSession();
    if (refreshToken) {
      // Best-effort server-side revocation; nothing in the UI waits on it.
      this.http.post(`${this.baseUrl}/logout`, { refreshToken }).subscribe({ error: () => {} });
    }
  }

  updateMe(payload: { name?: string; email?: string }): Observable<{ user: AuthUser }> {
    return this.http
      .put<{ user: AuthUser }>(`${this.baseUrl}/me`, payload)
      .pipe(tap(({ user }) => this.setUser(user)));
  }

  deleteMe(): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/me`).pipe(tap(() => this.logout()));
  }

  /** Always resolves the same way whether or not the email matched an
   * account -- the backend deliberately doesn't reveal which, so the UI
   * shouldn't either. */
  forgotPassword(email: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/reset-password`, { token, password });
  }

  /** Exchanges the stored refresh token for a new access token. Concurrent
   * callers (several requests 401ing at once) share one in-flight refresh
   * via shareReplay rather than each racing to rotate the same token --
   * only the first redemption of a refresh token succeeds server-side. */
  refreshAccessToken(): Observable<string | null> {
    if (!this.refreshToken) {
      return of(null);
    }
    if (!this.refreshRequest$) {
      this.refreshRequest$ = this.http.post<AuthSession>(`${this.baseUrl}/refresh`, { refreshToken: this.refreshToken }).pipe(
        tap((session) => this.setSession(session)),
        map((session) => session.accessToken),
        catchError(() => {
          this.clearSession();
          return of(null);
        }),
        finalize(() => (this.refreshRequest$ = null)),
        shareReplay(1),
      );
    }
    return this.refreshRequest$;
  }

  private setSession(session: AuthSession): void {
    this.accessToken = session.accessToken;
    this.refreshToken = session.refreshToken;
    this.currentUserSignal.set(session.user);
    void Preferences.set({ key: ACCESS_TOKEN_KEY, value: session.accessToken });
    void Preferences.set({ key: REFRESH_TOKEN_KEY, value: session.refreshToken });
    void Preferences.set({ key: USER_KEY, value: JSON.stringify(session.user) });
  }

  private setUser(user: AuthUser): void {
    this.currentUserSignal.set(user);
    void Preferences.set({ key: USER_KEY, value: JSON.stringify(user) });
  }

  private clearSession(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.currentUserSignal.set(null);
    void Preferences.remove({ key: ACCESS_TOKEN_KEY });
    void Preferences.remove({ key: REFRESH_TOKEN_KEY });
    void Preferences.remove({ key: USER_KEY });
  }
}
