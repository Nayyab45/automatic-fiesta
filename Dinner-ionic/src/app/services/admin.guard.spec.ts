import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('allows navigation when the current user is an admin', () => {
    authServiceSpy.currentUser.and.returnValue({ isAdmin: true } as never);

    const result = TestBed.runInInjectionContext(() => adminGuard(null as never, null as never));

    expect(result).toBeTrue();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /home when the current user is not an admin', () => {
    authServiceSpy.currentUser.and.returnValue({ isAdmin: false } as never);
    const fakeTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(fakeTree);

    const result = TestBed.runInInjectionContext(() => adminGuard(null as never, null as never));

    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/home']);
    expect(result).toBe(fakeTree);
  });

  it('redirects to /home when there is no current user at all', () => {
    authServiceSpy.currentUser.and.returnValue(null as never);
    const fakeTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(fakeTree);

    const result = TestBed.runInInjectionContext(() => adminGuard(null as never, null as never));

    expect(result).toBe(fakeTree);
  });
});
