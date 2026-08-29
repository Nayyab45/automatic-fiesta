import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { DiningTable, DiningTableService, TableGuest, TableMessage } from '../../services/dining-table.service';
import { ConversationPerson, DirectMessage, MessagingService } from '../../services/messaging.service';
import { AuthService } from '../../services/auth.service';
import { timeAgo } from '../../shared/time-ago';

interface ChatBubble {
  id: number;
  senderName: string;
  body: string;
  createdAt: string;
  isMine: boolean;
}

@Component({
  selector: 'app-dining-group-chat',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './dining-group-chat.page.html',
  styleUrl: './dining-group-chat.page.scss',
})
export class DiningGroupChatPage extends BasePage {
  readonly pageTitle = "Dining Group Chat";
  private readonly tableService = inject(DiningTableService);
  private readonly messagingService = inject(MessagingService);
  private readonly authService = inject(AuthService);

  readonly isDm = this.route.snapshot.data['mode'] === 'dm';
  readonly timeAgo = timeAgo;

  readonly table = signal<DiningTable | null>(null);
  readonly guests = signal<TableGuest[]>([]);
  readonly dmPerson = signal<ConversationPerson | null>(null);
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly bubbles = signal<ChatBubble[]>([]);

  private readonly conversationOrTableId = this.routeId();
  private readonly myId = this.authService.currentUser()?.id ?? null;

  constructor() {
    super();
    const id = this.conversationOrTableId;
    if (!id) {
      this.loading.set(false);
      return;
    }

    if (this.isDm) {
      this.messagingService.get(id).subscribe(({ conversation }) => this.dmPerson.set(conversation.person));
      this.messagingService.messages(id).subscribe({
        next: ({ messages }) => {
          this.bubbles.set(messages.map((m) => this.toBubble(m)));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      this.messagingService.markRead(id).subscribe();
    } else {
      this.tableService.get(id).subscribe({
        next: ({ table }) => {
          this.table.set(table);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      this.tableService.guests(id).subscribe(({ guests }) => this.guests.set(guests));
      this.tableService.messages(id).subscribe(({ messages }) => this.bubbles.set(messages.map((m) => this.toBubble(m))));
    }
  }

  private toBubble(message: TableMessage | DirectMessage): ChatBubble {
    return {
      id: message.id,
      senderName: message.senderName,
      body: message.body,
      createdAt: message.createdAt,
      isMine: message.senderId === this.myId,
    };
  }

  sendMessage(input: HTMLInputElement): void {
    const text = input.value.trim();
    const id = this.conversationOrTableId;
    if (!text || !id || this.sending()) return;

    this.sending.set(true);
    const request$: Observable<{ message: TableMessage | DirectMessage }> = this.isDm
      ? this.messagingService.sendMessage(id, text)
      : this.tableService.sendMessage(id, text);
    request$.subscribe({
      next: ({ message }) => {
        this.bubbles.update((list) => [...list, this.toBubble(message)]);
        this.sending.set(false);
        input.value = '';
      },
      error: () => this.sending.set(false),
    });
  }
}
