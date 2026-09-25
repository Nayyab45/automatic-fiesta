import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RootHeaderComponent } from '../../components/root-header/root-header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { LocationService } from '../../services/location.service';
import { AuthService } from '../../services/auth.service';
import { ConversationSummary, MessagingService } from '../../services/messaging.service';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';
import { AppNotification, NotificationService } from '../../services/notification.service';
import { timeAgo } from '../../shared/time-ago';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, RootHeaderComponent, ConfirmDialogComponent],
  templateUrl: './messages.page.html',
  styleUrl: './messages.page.scss',
})
export class MessagesPage extends BasePage {
  readonly pageTitle = "Messages";
  readonly cityService = inject(LocationService);
  private readonly authService = inject(AuthService);
  private readonly messagingService = inject(MessagingService);
  private readonly tableService = inject(DiningTableService);
  private readonly notificationService = inject(NotificationService);
  readonly timeAgo = timeAgo;

  readonly activeTab = signal<'messages' | 'groups'>('messages');
  readonly conversations = signal<ConversationSummary[]>([]);
  readonly groups = signal<DiningTable[]>([]);
  readonly loadingConversations = signal(true);
  readonly loadingGroups = signal(true);

  // Drives the dot on the header's bell icon -- see notifications.page.ts's
  // identical hasUnread, this just needs the boolean, not the list itself.
  readonly notifications = signal<AppNotification[]>([]);
  readonly hasUnreadNotifications = computed(() => this.notifications().some((n) => !n.read));

  readonly selecting = signal(false);
  readonly selectedConversationIds = signal<Set<number>>(new Set());
  readonly selectedGroupIds = signal<Set<number>>(new Set());
  readonly selectedCount = computed(() => this.selectedConversationIds().size + this.selectedGroupIds().size);
  readonly showDeleteConfirm = signal(false);
  readonly deleting = signal(false);

  constructor() {
    super();
    // Ionic's route-reuse strategy (see main.ts) can keep this page's
    // component instance alive across a log-out/log-in-as-someone-else
    // cycle, since "/messages" is reused by route, not by which account is
    // signed in -- see the identical fix in home.page.ts/profile.page.ts.
    effect(
      () => {
        if (!this.authService.currentUser()) return;
        this.exitSelection();

        this.loadingConversations.set(true);
        this.messagingService.list().subscribe({
          next: ({ conversations }) => {
            this.conversations.set(conversations);
            this.loadingConversations.set(false);
          },
          error: () => this.loadingConversations.set(false),
        });

        this.loadingGroups.set(true);
        this.tableService.listMine().subscribe({
          next: ({ tables }) => {
            // A hidden group chat (see deleteChat()) stays out of this list
            // only -- My Tables and the event itself are unaffected, so
            // filtering happens here rather than on the shared endpoint.
            this.groups.set(tables.filter((t) => !t.chatHidden));
            this.loadingGroups.set(false);
          },
          error: () => this.loadingGroups.set(false),
        });

        this.notificationService.list().subscribe({
          next: ({ notifications }) => this.notifications.set(notifications),
          error: () => {},
        });
      },
      { allowSignalWrites: true },
    );
  }

  selectTab(tab: 'messages' | 'groups'): void {
    this.activeTab.set(tab);
  }

  toggleSelecting(): void {
    if (this.selecting()) {
      this.exitSelection();
    } else {
      this.selecting.set(true);
    }
  }

  private exitSelection(): void {
    this.selecting.set(false);
    this.selectedConversationIds.set(new Set());
    this.selectedGroupIds.set(new Set());
  }

  /** Row tap while selecting toggles its checkbox instead of opening the
   * chat -- go() (via routerLink-style navigation) is skipped entirely for
   * that tap by the template's click handler. */
  toggleConversationSelected(id: number): void {
    this.selectedConversationIds.update((ids) => {
      const next = new Set(ids);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  toggleGroupSelected(id: number): void {
    this.selectedGroupIds.update((ids) => {
      const next = new Set(ids);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  deleteSelected(): void {
    if (this.deleting() || this.selectedCount() === 0) return;
    this.deleting.set(true);

    const conversationIds = [...this.selectedConversationIds()];
    const groupIds = [...this.selectedGroupIds()];
    const requests = [
      ...conversationIds.map((id) => this.messagingService.delete(id)),
      ...groupIds.map((id) => this.tableService.deleteChat(id)),
    ];

    // Best-effort per item rather than all-or-nothing: one already-gone
    // conversation shouldn't stop the rest of the selection from deleting.
    let remaining = requests.length;
    const settle = () => {
      remaining -= 1;
      if (remaining > 0) return;
      this.conversations.update((list) => list.filter((c) => !conversationIds.includes(c.id)));
      this.groups.update((list) => list.filter((g) => !groupIds.includes(g.id)));
      this.deleting.set(false);
      this.showDeleteConfirm.set(false);
      this.exitSelection();
    };
    requests.forEach((request) => request.subscribe({ next: settle, error: settle }));
  }
}
