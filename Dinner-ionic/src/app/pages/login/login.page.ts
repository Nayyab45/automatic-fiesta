import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { BasePage } from '../base.page';
import { AuthService, LoginResult } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, FormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage extends BasePage {
  readonly pageTitle = "Login";
  passwordVisible = false;

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Set once /auth/login answers "correct password, now enter your
  // authenticator code" instead of a session -- switches the template to a
  // second step rather than a separate route, since it's the same form
  // interaction just gated on one more field.
  readonly twoFactorChallengeToken = signal<string | null>(null);
  twoFactorCode = '';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();

    this.authService.login(email, password).subscribe({
      next: (result) => this.handleLoginResult(result),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.message ?? 'Unable to sign in. Please try again.');
      },
    });
  }

  continueWithGoogle(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.signInWithGoogle().subscribe({
      next: (result) => this.handleLoginResult(result),
      error: (err) => {
        this.submitting.set(false);
        // TEMP diagnostic logging -- remove once the Google Sign-In failure
        // is root-caused (see conversation). Capacitor forwards WebView
        // console output to logcat regardless of build type.
        console.error('[google-signin] raw error:', JSON.stringify(err), err);
        // A user backing out of the account picker isn't an error worth
        // showing -- same as tapping outside a dialog to dismiss it.
        if (err?.code === 'USER_CANCELLED') return;
        this.errorMessage.set(err?.error?.message ?? 'Unable to sign in with Google. Please try again.');
      },
    });
  }

  private handleLoginResult(result: LoginResult): void {
    if ('twoFactorRequired' in result) {
      this.submitting.set(false);
      this.twoFactorChallengeToken.set(result.challengeToken);
      return;
    }
    this.navigateAfterLogin();
  }

  // An admin account's whole purpose is running the admin panel -- lands
  // there directly instead of the regular consumer app. Reads isAdmin off
  // the session AuthService just stored (part of the login/2FA response
  // itself, see Backend's toPublicUser) rather than a separate follow-up
  // request -- an extra round-trip right after login is one more thing
  // that can fail on this host's flaky connection, silently dropping an
  // admin onto the regular app instead.
  private navigateAfterLogin(): void {
    this.go(this.authService.currentUser()?.isAdmin ? '/admin' : '/home');
  }

  submitTwoFactorCode(): void {
    const challengeToken = this.twoFactorChallengeToken();
    if (!challengeToken || !this.twoFactorCode || this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.authService.verify2faLogin(challengeToken, this.twoFactorCode).subscribe({
      next: () => this.navigateAfterLogin(),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.message ?? 'Incorrect code. Please try again.');
      },
    });
  }
}
