import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { VerificationService } from '../../services/verification.service';
import { ModerationService } from '../../services/moderation.service';
import { SupportService } from '../../services/support.service';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './admin-home.page.html',
  styleUrl: './admin-home.page.scss',
})
export class AdminHomePage extends BasePage {
  readonly pageTitle = 'Admin';
  private readonly verificationService = inject(VerificationService);
  private readonly moderationService = inject(ModerationService);
  private readonly supportService = inject(SupportService);

  readonly pendingVerificationsCount = signal(0);
  readonly flaggedUsersCount = signal(0);
  readonly openSupportCount = signal(0);

  constructor() {
    super();
    this.verificationService.pending().subscribe({ next: ({ submissions }) => this.pendingVerificationsCount.set(submissions.length), error: () => {} });
    this.moderationService.flagged().subscribe({ next: ({ flagged }) => this.flaggedUsersCount.set(flagged.length), error: () => {} });
    this.supportService.list().subscribe({
      next: ({ messages }) => this.openSupportCount.set(messages.filter((m) => m.status === 'open').length),
      error: () => {},
    });
  }
}
