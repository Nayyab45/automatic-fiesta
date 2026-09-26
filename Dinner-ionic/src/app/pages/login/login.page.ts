import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { filter } from 'rxjs';
import { BasePage } from '../base.page';
import { AuthService } from '../../services/auth.service';

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

  // Bumped whenever an attempt starts or the page reactivates (see
  // constructor). Native sign-in calls aren't cancellable once fired -- if
  // the user navigates away mid-attempt (the "Sign Up"/"Forgot Password?"
  // links aren't submitting-gated) and back again, a stale attempt's
  // next/error callback can still land later on this same cached instance.
  // Comparing against the token captured when that attempt started lets the
  // callbacks recognize and ignore a result that's no longer current,
  // instead of navigating away or showing an error for an attempt the user
  // has already abandoned.
  private attemptToken = 0;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    super();
    // IonicRouteStrategy (main.ts) caches routed components instead of
    // destroying them, so navigating back to /login after logout can
    // reattach this exact instance -- stale `submitting`/`errorMessage`
    // left over from a previous attempt would otherwise show immediately,
    // before the user has touched anything. ngOnInit doesn't re-run on
    // reattachment, so reset on every completed navigation instead.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter((event) => this.router.url.split('?')[0] === '/login'),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.attemptToken++;
        this.submitting.set(false);
        this.errorMessage.set(null);
      });
  }

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
    const token = ++this.attemptToken;

    this.authService.login(email, password).subscribe({
      next: () => {
        if (token !== this.attemptToken) return;
        this.navigateAfterLogin();
      },
      error: (err: HttpErrorResponse) => {
        if (token !== this.attemptToken) return;
        this.submitting.set(false);
        this.errorMessage.set(err.error?.message ?? 'Unable to sign in. Please try again.');
      },
    });
  }

  continueWithGoogle(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    const token = ++this.attemptToken;

    this.authService.signInWithGoogle().subscribe({
      next: () => {
        if (token !== this.attemptToken) return;
        this.navigateAfterLogin();
      },
      error: (err) => {
        if (token !== this.attemptToken) return;
        this.submitting.set(false);
        // A user backing out of the account picker isn't an error worth
        // showing -- same as tapping outside a dialog to dismiss it.
        if (err?.code === 'USER_CANCELLED') return;
        this.errorMessage.set(err?.error?.message ?? 'Unable to sign in with Google. Please try again.');
      },
    });
  }

  private navigateAfterLogin(): void {
    this.go('/home');
  }
}
