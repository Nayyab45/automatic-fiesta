import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await Preferences.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    httpMock.verify();
    await Preferences.clear();
  });

  it('starts signed out until hydrate() or login() runs', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.token).toBeNull();
  });

  it('login() stores the session and marks the user authenticated', () => {
    service.login('jane@example.com', 'password123').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 1, name: 'Jane', email: 'jane@example.com' },
    });

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.token).toBe('access-1');
    expect(service.currentUser()?.name).toBe('Jane');
  });

  it('persists the session to Preferences so a later hydrate() restores it', async () => {
    service.login('jane@example.com', 'password123').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 1, name: 'Jane', email: 'jane@example.com' },
    });

    // A fresh TestBed module gives a brand-new AuthService instance with
    // nothing in memory, simulating a cold app start where only hydrate()
    // can restore state -- from whatever the first instance wrote to
    // Preferences above.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const freshService = TestBed.inject(AuthService);
    await freshService.hydrate();

    expect(freshService.isAuthenticated()).toBeTrue();
    expect(freshService.token).toBe('access-1');
  });

  it('logout() clears local session state and best-effort revokes the refresh token', () => {
    service.login('jane@example.com', 'password123').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 1, name: 'Jane', email: 'jane@example.com' },
    });

    service.logout();

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.token).toBeNull();

    const revokeReq = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(revokeReq.request.body).toEqual({ refreshToken: 'refresh-1' });
    revokeReq.flush({ ok: true });
  });

  it('refreshAccessToken() exchanges the refresh token and rotates the session', () => {
    service.login('jane@example.com', 'password123').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 1, name: 'Jane', email: 'jane@example.com' },
    });

    let newToken: string | null | undefined;
    service.refreshAccessToken().subscribe((token) => (newToken = token));

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      user: { id: 1, name: 'Jane', email: 'jane@example.com' },
    });

    expect(newToken).toBe('access-2');
    expect(service.token).toBe('access-2');
  });

  it('refreshAccessToken() shares one in-flight request across concurrent callers', () => {
    service.login('jane@example.com', 'password123').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 1, name: 'Jane', email: 'jane@example.com' },
    });

    const results: (string | null)[] = [];
    service.refreshAccessToken().subscribe((t) => results.push(t as string));
    service.refreshAccessToken().subscribe((t) => results.push(t as string));

    // Two 401s racing to refresh must not redeem the (single-use) refresh
    // token twice -- only one HTTP call should go out for both callers.
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    req.flush({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      user: { id: 1, name: 'Jane', email: 'jane@example.com' },
    });

    expect(results).toEqual(['access-2', 'access-2']);
  });

  it('refreshAccessToken() clears the session when the refresh token is rejected', () => {
    service.login('jane@example.com', 'password123').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 1, name: 'Jane', email: 'jane@example.com' },
    });

    let result: string | null | undefined;
    service.refreshAccessToken().subscribe((t) => (result = t));

    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush({ message: 'Invalid or expired refresh token' }, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('refreshAccessToken() resolves to null immediately when there is no session', () => {
    let result: string | null | undefined = 'unset';
    service.refreshAccessToken().subscribe((t) => (result = t));

    httpMock.expectNone(`${environment.apiUrl}/auth/refresh`);
    expect(result).toBeNull();
  });
});
