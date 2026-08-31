import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { BasePage } from '../base.page';
import { AuthService } from '../../services/auth.service';
import { passwordErrorMessage, strongPasswordValidator } from '../../shared/password-validator';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './signup.page.html',
  styleUrl: './signup.page.scss',
})
export class SignupPage extends BasePage {
  readonly pageTitle = "Sign Up";

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, strongPasswordValidator()]],
    terms: [false, [Validators.requiredTrue]],
  });

  get passwordErrorMessage(): string | null {
    const control = this.form.controls.password;
    return control.touched ? passwordErrorMessage(control.errors) : null;
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const { name, email, password } = this.form.getRawValue();

    this.authService.signup(name, email, password).subscribe({
      next: () => this.go('/profile-creation'),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.message ?? 'Unable to create account. Please try again.');
      },
    });
  }
}
