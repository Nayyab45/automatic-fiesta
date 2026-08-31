import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { BasePage } from '../base.page';
import { AuthService } from '../../services/auth.service';
import { passwordErrorMessage, strongPasswordValidator } from '../../shared/password-validator';

// The screen an emailed reset link actually lands on (?token=...) -- the
// original prototype only covered "request a link" and "check your email";
// nothing let a user type the new password itself, so the reset flow could
// never be completed. There's no prototype mockup for this one; it borrows
// the same lock_reset/input-focus-ring look as reset-password.page for
// visual consistency.
@Component({
  selector: 'app-reset-password-new',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './reset-password-new.page.html',
  styleUrl: './reset-password-new.page.scss',
})
export class ResetPasswordNewPage extends BasePage {
  readonly pageTitle = 'Set New Password';
  passwordVisible = false;

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly token = this.route.snapshot.queryParamMap.get('token');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(
    this.token ? null : 'This reset link is missing its token. Request a new one.',
  );

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, strongPasswordValidator()]],
    confirmPassword: ['', [Validators.required]],
  });

  get passwordErrorMessage(): string | null {
    const control = this.form.controls.password;
    return control.touched ? passwordErrorMessage(control.errors) : null;
  }

  submit(): void {
    if (!this.token || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const { password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.errorMessage.set("Passwords don't match");
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.resetPassword(this.token, password).subscribe({
      next: () => this.go('/login'),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.message ?? 'This reset link is invalid or has expired.');
      },
    });
  }
}
