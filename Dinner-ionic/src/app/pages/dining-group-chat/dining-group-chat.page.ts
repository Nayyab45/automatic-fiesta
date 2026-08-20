import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

interface ChatMessage {
  text: string;
  time: string;
}

@Component({
  selector: 'app-dining-group-chat',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dining-group-chat.page.html',
  styleUrl: './dining-group-chat.page.scss',
})
export class DiningGroupChatPage {
  readonly pageTitle = "Dining Group Chat";
  ownMessages: ChatMessage[] = [];

  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

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
