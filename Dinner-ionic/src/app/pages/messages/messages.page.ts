import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';
import { ConversationSummary, MessagingService } from '../../services/messaging.service';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';
import { timeAgo } from '../../shared/time-ago';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './messages.page.html',
  styleUrl: './messages.page.scss',
})
export class MessagesPage extends BasePage {
  readonly pageTitle = "Messages";
  readonly cityService = inject(LocationService);
  private readonly messagingService = inject(MessagingService);
  private readonly tableService = inject(DiningTableService);
  readonly timeAgo = timeAgo;

  readonly activeTab = signal<'messages' | 'groups'>('messages');
  readonly conversations = signal<ConversationSummary[]>([]);
  readonly groups = signal<DiningTable[]>([]);
  readonly loadingConversations = signal(true);
  readonly loadingGroups = signal(true);

  constructor() {
    super();
    this.messagingService.list().subscribe({
      next: ({ conversations }) => {
        this.conversations.set(conversations);
        this.loadingConversations.set(false);
      },
      error: () => this.loadingConversations.set(false),
    });
    this.tableService.listMine().subscribe({
      next: ({ tables }) => {
        this.groups.set(tables);
        this.loadingGroups.set(false);
      },
      error: () => this.loadingGroups.set(false),
    });
  }

  selectTab(tab: 'messages' | 'groups'): void {
    this.activeTab.set(tab);
  }
}
