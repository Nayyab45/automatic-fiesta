import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { AdminService, AdminUserDetail, AdminUserReport } from '../../services/admin.service';
import { ModerationService } from '../../services/moderation.service';

@Component({
  selector: 'app-admin-user-detail',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './admin-user-detail.page.html',
  styleUrl: './admin-user-detail.page.scss',
})
export class AdminUserDetailPage extends BasePage {
  readonly pageTitle = 'User Details';
  private readonly adminService = inject(AdminService);
  private readonly moderationService = inject(ModerationService);

  readonly user = signal<AdminUserDetail | null>(null);
  readonly reports = signal<AdminUserReport[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    super();
    // Not an effect(): load() writes signals, which Angular 18 forbids from
    // inside one (NG0600) -- that silently broke this whole page.
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) this.load(id);
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.adminService.user(id).subscribe({
      next: ({ user }) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.adminService.userReports(id).subscribe({ next: ({ reports }) => this.reports.set(reports), error: () => {} });
  }

  suspend(): void {
    const user = this.user();
    if (!user || this.acting()) return;
    const reason = prompt(`Reason for suspending ${user.name}? They'll see this when they try to sign in.`)?.trim();
    if (!reason) return;
    this.run(this.adminService.suspend(user.id, reason));
  }

  unsuspend(): void {
    const user = this.user();
    if (!user || this.acting()) return;
    this.run(this.adminService.unsuspend(user.id));
  }

  deleteAccount(): void {
    const user = this.user();
    if (!user || this.acting()) return;
    if (!confirm(`Permanently delete ${user.name}'s account? This can't be undone.`)) return;
    this.acting.set(true);
    this.moderationService.deleteAccount(user.id).subscribe({
      next: () => this.go('/admin/users'),
      error: () => {
        this.acting.set(false);
        this.error.set("Couldn't delete this account.");
      },
    });
  }

  private run(request: ReturnType<AdminService['suspend']>): void {
    this.acting.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.acting.set(false);
        const id = this.routeId();
        if (id) this.load(id);
      },
      error: () => {
        this.acting.set(false);
        this.error.set('That action failed. Try again.');
      },
    });
  }
}
