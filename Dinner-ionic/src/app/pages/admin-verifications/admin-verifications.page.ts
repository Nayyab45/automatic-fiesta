import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { PendingVerification, VerificationService } from '../../services/verification.service';

@Component({
  selector: 'app-admin-verifications',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './admin-verifications.page.html',
  styleUrl: './admin-verifications.page.scss',
})
export class AdminVerificationsPage extends BasePage {
  readonly pageTitle = 'Review Verifications';
  private readonly verificationService = inject(VerificationService);

  readonly submissions = signal<PendingVerification[]>([]);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly decidingUserId = signal<number | null>(null);

  constructor() {
    super();
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.verificationService.pending().subscribe({
      next: ({ submissions }) => {
        this.submissions.set(submissions);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.forbidden.set(err.status === 403);
        this.loading.set(false);
      },
    });
  }

  decide(submission: PendingVerification, status: 'approved' | 'rejected'): void {
    if (this.decidingUserId()) return;
    this.decidingUserId.set(submission.userId);
    this.verificationService.decide(submission.userId, status).subscribe({
      next: () => {
        this.decidingUserId.set(null);
        this.submissions.update((list) => list.filter((s) => s.userId !== submission.userId));
      },
      error: () => this.decidingUserId.set(null),
    });
  }
}
