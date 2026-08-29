import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['refreshAccessToken'], { token: 'access-1' });
    routerSpy = jasmine.createSpyObj('Router', ['navigateByUrl']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the access token as a bearer header', () => {
    http.get('/api/profile/me').subscribe();

    const req = httpMock.expectOne('/api/profile/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
  });

  it('silently refreshes and retries the request once on a 401', () => {
    authServiceSpy.refreshAccessToken.and.returnValue(of('access-2'));

    let result: unknown;
    http.get('/api/profile/me').subscribe((r) => (result = r));

    httpMock.expectOne('/api/profile/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(authServiceSpy.refreshAccessToken).toHaveBeenCalled();

    const retry = httpMock.expectOne('/api/profile/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ ok: true });

    expect(result).toEqual({ ok: true });
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('redirects to /login and surfaces the error when refresh also fails', () => {
    authServiceSpy.refreshAccessToken.and.returnValue(of(null));

    let errored = false;
    http.get('/api/profile/me').subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/api/profile/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('does not attempt a refresh when a login request itself 401s', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => {} });

    httpMock.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('passes through non-401 errors without touching refresh', () => {
    let errored = false;
    http.get('/api/profile/me').subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/api/profile/me').flush(null, { status: 500, statusText: 'Server Error' });

    expect(errored).toBeTrue();
    expect(authServiceSpy.refreshAccessToken).not.toHaveBeenCalled();
  });
});
