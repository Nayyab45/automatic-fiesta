import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { VerificationService, VerificationStatus } from '../../services/verification.service';

@Component({
  selector: 'app-identity-verification',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './identity-verification.page.html',
  styleUrl: './identity-verification.page.scss',
})
export class IdentityVerificationPage extends BasePage {
  readonly pageTitle = "Identity Verification";
  private readonly verificationService = inject(VerificationService);

  readonly loading = signal(true);
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
}
