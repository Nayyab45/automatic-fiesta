import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { VerificationService, VerificationStatus } from '../../services/verification.service';

@Component({
  selector: 'app-identity-verification-submit-review',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './identity-verification-submit-review.page.html',
  styleUrl: './identity-verification-submit-review.page.scss',
})
export class IdentityVerificationSubmitReviewPage extends BasePage {
  readonly pageTitle = "Identity Verification - Review";
  private readonly verificationService = inject(VerificationService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly verification = signal<VerificationStatus | null>(null);

  constructor() {
    super();
    this.verificationService.status().subscribe({
      next: (status) => {
        this.verification.set(status);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.verificationService.submit().subscribe({
      next: () => this.go('/identity-verification'),
      error: () => this.submitting.set(false),
    });
  }
}
