import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { FlaggedUser, ModerationService } from '../../services/moderation.service';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-moderation',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './admin-moderation.page.html',
  styleUrl: './admin-moderation.page.scss',
})
export class AdminModerationPage extends BasePage {
  readonly pageTitle = 'Moderation Queue';
  private readonly moderationService = inject(ModerationService);
  private readonly adminService = inject(AdminService);

  readonly flagged = signal<FlaggedUser[]>([]);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly actingOnUserId = signal<number | null>(null);

  constructor() {
    super();
    this.moderationService.flagged().subscribe({
      next: ({ flagged }) => {
        this.flagged.set(flagged);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.forbidden.set(err.status === 403);
        this.loading.set(false);
      },
    });
  }

  dismiss(user: FlaggedUser): void {
    if (this.actingOnUserId()) return;
    this.actingOnUserId.set(user.userId);
    this.moderationService.dismiss(user.userId).subscribe({
      next: () => {
        this.actingOnUserId.set(null);
        this.flagged.update((list) => list.filter((u) => u.userId !== user.userId));
      },
      error: () => this.actingOnUserId.set(null),
    });
  }

  // Middle ground between Dismiss and permanent Delete: blocks sign-in and
  // ends their sessions but keeps the account. Also clears the flag, since
  // suspending is itself the review decision.
  suspend(user: FlaggedUser): void {
    if (this.actingOnUserId()) return;
    const reason = prompt(`Reason for suspending ${user.name}? They'll see this when they try to sign in.`)?.trim();
    if (!reason) return;
    this.actingOnUserId.set(user.userId);
    this.adminService.suspend(user.userId, reason).subscribe({
      next: () =>
        this.moderationService.dismiss(user.userId).subscribe({
          next: () => {
            this.actingOnUserId.set(null);
            this.flagged.update((list) => list.filter((u) => u.userId !== user.userId));
          },
          error: () => this.actingOnUserId.set(null),
        }),
      error: () => this.actingOnUserId.set(null),
    });
  }

  deleteAccount(user: FlaggedUser): void {
    if (this.actingOnUserId()) return;
    if (!confirm(`Permanently delete ${user.name}'s account? This can't be undone.`)) return;
    this.actingOnUserId.set(user.userId);
    this.moderationService.deleteAccount(user.userId).subscribe({
      next: () => {
        this.actingOnUserId.set(null);
        this.flagged.update((list) => list.filter((u) => u.userId !== user.userId));
      },
      error: () => this.actingOnUserId.set(null),
    });
  }
}
