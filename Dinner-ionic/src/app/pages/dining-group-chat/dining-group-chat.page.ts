import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';

interface ChatMessage {
  text: string;
  time: string;
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
  ownMessages: ChatMessage[] = [];

  private timeNow(): string {
    return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  sendMessage(input: HTMLInputElement): void {
    const text = input.value.trim();
    if (!text) return;
    this.ownMessages.push({ text, time: this.timeNow() });
    input.value = '';
  }

  attachFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.ownMessages.push({ text: `📎 ${file.name}`, time: this.timeNow() });
    (event.target as HTMLInputElement).value = '';
  }
}
