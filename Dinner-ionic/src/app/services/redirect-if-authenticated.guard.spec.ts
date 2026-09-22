import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { redirectIfAuthenticatedGuard } from './redirect-if-authenticated.guard';
import { AuthService } from './auth.service';

describe('redirectIfAuthenticatedGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('allows navigation to the public entry screen when signed out', () => {
    authServiceSpy.isAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => redirectIfAuthenticatedGuard(null as never, null as never));

    expect(result).toBeTrue();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /home when a valid session already exists', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    const fakeTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(fakeTree);

    const result = TestBed.runInInjectionContext(() => redirectIfAuthenticatedGuard(null as never, null as never));

    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/home']);
    expect(result).toBe(fakeTree);
  });
});
