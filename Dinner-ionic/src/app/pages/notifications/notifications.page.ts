import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { AppNotification, NotificationService } from '../../services/notification.service';
import { timeAgo } from '../../shared/time-ago';

const TYPE_ICONS: Record<string, string> = {
  table_seat_joined: 'group_add',
  table_invite_received: 'mail',
  table_invite_accepted: 'check',
  table_invite_declined: 'close',
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
    if (!n.read) {
      // Fire-and-forget: the dot disappears immediately client-side rather
      // than waiting on the round-trip, and this doesn't block navigation.
      this.notificationService.markRead(n.id).subscribe({ error: () => {} });
      this.notifications.update((list) => list.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
    }

    // A table notification names the table it's about -- route straight to
    // it (where a pending invite's Accept/Decline buttons live, for
    // table_invite_received) rather than just their counterpart's profile.
    const tableTypes = ['table_seat_joined', 'table_invite_received', 'table_invite_accepted', 'table_invite_declined'];
    if (tableTypes.includes(n.type) && n.tableId) {
      this.go(`/dining-event-details/${n.tableId}`);
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
