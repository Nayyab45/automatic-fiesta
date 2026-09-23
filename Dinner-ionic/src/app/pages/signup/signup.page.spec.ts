import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SignupPage } from './signup.page';
import { AuthService } from '../../services/auth.service';

// Not type-annotated -- structurally satisfies both signup()'s unexported
// AuthSession return type and signInWithGoogle()'s LoginResult.
const SESSION = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: { id: 1, name: 'Sam Ali', email: 'sam@example.com' },
};

describe('SignupPage', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [SignupPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceSpy }],
    });
    return TestBed.createComponent(SignupPage);
  }

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['signup', 'signInWithGoogle']);
  });

  function fillValidForm(page: SignupPage) {
    page.form.setValue({ name: 'Sam Ali', email: 'sam@example.com', password: 'Password123!', terms: true });
  }

  it('does not submit, and marks fields touched, when the form is invalid', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.submit();

    expect(authServiceSpy.signup).not.toHaveBeenCalled();
    expect(page.form.controls.name.touched).toBeTrue();
  });

  it('requires the terms checkbox even when every other field is valid', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.form.setValue({ name: 'Sam Ali', email: 'sam@example.com', password: 'Password123!', terms: false });

    page.submit();

    expect(authServiceSpy.signup).not.toHaveBeenCalled();
    expect(page.form.invalid).toBeTrue();
  });

  it('signs up and navigates to /profile-creation on success', () => {
    authServiceSpy.signup.and.returnValue(of(SESSION));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    fillValidForm(page);
    page.submit();

    expect(authServiceSpy.signup).toHaveBeenCalledWith('Sam Ali', 'sam@example.com', 'Password123!');
    // submitting is deliberately left true on a successful, navigating-away
    // signup -- there's no next state where the form should re-enable.
    expect(navigateSpy).toHaveBeenCalledWith('/profile-creation');
  });

  it('shows the server error message and stops submitting when the email is already registered', () => {
    authServiceSpy.signup.and.returnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Email already registered' }, status: 409 })),
    );

    const fixture = createComponent();
    const page = fixture.componentInstance;
    fillValidForm(page);
    page.submit();

    expect(page.submitting()).toBeFalse();
    expect(page.errorMessage()).toBe('Email already registered');
  });

  it('continueWithGoogle() navigates to /profile-creation for a brand-new account', () => {
    authServiceSpy.signInWithGoogle.and.returnValue(of(SESSION));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    page.continueWithGoogle();

    expect(navigateSpy).toHaveBeenCalledWith('/profile-creation');
  });

  it('a cancelled Google sign-in is silently ignored, not shown as an error', () => {
    authServiceSpy.signInWithGoogle.and.returnValue(throwError(() => ({ code: 'USER_CANCELLED' })));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.continueWithGoogle();

    expect(page.submitting()).toBeFalse();
    expect(page.errorMessage()).toBeNull();
  });

  it('passwordErrorMessage is null until the password field has been touched', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.form.controls.password.setValue('short');
    expect(page.passwordErrorMessage).toBeNull();
    page.form.controls.password.markAsTouched();
    expect(page.passwordErrorMessage).not.toBeNull();
  });
});
