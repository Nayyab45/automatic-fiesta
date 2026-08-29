import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { AppNotification, NotificationService } from '../../services/notification.service';
import { timeAgo } from '../../shared/time-ago';

const TYPE_ICONS: Record<string, string> = {
  seat_request_received: 'mail',
  seat_request_confirmed: 'check',
  seat_request_declined: 'schedule',
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
})
export class NotificationsPage extends BasePage {
  readonly pageTitle = "Notifications";
  private readonly notificationService = inject(NotificationService);

  readonly notifications = signal<AppNotification[]>([]);
  readonly loading = signal(true);
  readonly hasUnread = computed(() => this.notifications().some((n) => !n.read));
  readonly timeAgo = timeAgo;

  constructor() {
    super();
    this.notificationService.list().subscribe({
      next: ({ notifications }) => {
        this.notifications.set(notifications);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  iconFor(type: string): string {
    return TYPE_ICONS[type] ?? 'notifications';
  }

  markAllAsRead(): void {
    if (!this.hasUnread()) return;
    this.notificationService.markAllRead().subscribe(() => {
      this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    });
  }
}
