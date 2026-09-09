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
  friend_request_received: 'person_add',
  friend_request_accepted: 'how_to_reg',
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

  open(n: AppNotification): void {
    // A seat-request notification names the table it's about -- route the
    // host to the request they need to act on, or the guest to their
    // request's live status, rather than just their counterpart's profile.
    if (n.type === 'seat_request_received' && n.tableId) {
      this.go(`/manage-seat-requests/${n.tableId}`);
      return;
    }
    if ((n.type === 'seat_request_confirmed' || n.type === 'seat_request_declined') && n.tableId) {
      this.go(`/request-status/${n.tableId}`);
      return;
    }
    if (n.actorUserId) this.go(`/profile/${n.actorUserId}`);
  }

  markAllAsRead(): void {
    if (!this.hasUnread()) return;
    this.notificationService.markAllRead().subscribe(() => {
      this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    });
  }
}
