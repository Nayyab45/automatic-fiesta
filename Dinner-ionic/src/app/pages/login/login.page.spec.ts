import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { LoginPage } from './login.page';
import { AuthService } from '../../services/auth.service';

const SESSION = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: { id: 1, name: 'Sam Ali', email: 'sam@example.com' },
};

describe('LoginPage', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceSpy }],
    });
    return TestBed.createComponent(LoginPage);
  }

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login', 'signInWithGoogle', 'currentUser']);
  });

  it('does not submit, and marks fields touched, when the form is invalid', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.submit();

    expect(authServiceSpy.login).not.toHaveBeenCalled();
    expect(page.form.controls.email.touched).toBeTrue();
  });

  it('navigates to /home on a successful login', () => {
    authServiceSpy.login.and.returnValue(of(SESSION));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    page.form.setValue({ email: 'sam@example.com', password: 'password123!' });
    page.submit();

    expect(authServiceSpy.login).toHaveBeenCalledWith('sam@example.com', 'password123!');
    // submitting is deliberately left true on a successful, navigating-away
    // login -- there's no next state where the form should re-enable.
    expect(navigateSpy).toHaveBeenCalledWith('/home');
  });

  it('shows the server error message and stops submitting on a failed login', () => {
    authServiceSpy.login.and.returnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Wrong password' }, status: 401 })),
    );

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.form.setValue({ email: 'sam@example.com', password: 'wrong' });
    page.submit();

    expect(page.submitting()).toBeFalse();
    expect(page.errorMessage()).toBe('Wrong password');
  });

  it('a cancelled Google sign-in is silently ignored, not shown as an error', () => {
    authServiceSpy.signInWithGoogle.and.returnValue(throwError(() => ({ code: 'USER_CANCELLED' })));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.continueWithGoogle();

    expect(page.submitting()).toBeFalse();
    expect(page.errorMessage()).toBeNull();
  });

  it('togglePasswordVisibility() flips passwordVisible', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    expect(page.passwordVisible).toBeFalse();
    page.togglePasswordVisibility();
    expect(page.passwordVisible).toBeTrue();
  });
});
