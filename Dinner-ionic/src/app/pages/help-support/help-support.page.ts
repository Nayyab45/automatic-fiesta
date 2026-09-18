import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { SupportService } from '../../services/support.service';

@Component({
  selector: 'app-help-support',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HeaderComponent],
  templateUrl: './help-support.page.html',
  styleUrl: './help-support.page.scss',
})
export class HelpSupportPage extends BasePage {
  readonly pageTitle = "Help & Support";
  private readonly supportService = inject(SupportService);

  readonly showContactForm = signal(false);
  readonly sending = signal(false);
  readonly sent = signal(false);
  subject = '';
  message = '';

  toggleContactForm(): void {
    this.showContactForm.update((v) => !v);
  }

  sendMessage(): void {
    if (this.sending() || !this.subject.trim() || !this.message.trim()) return;
    this.sending.set(true);
    this.supportService.submit(this.subject.trim(), this.message.trim()).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
        this.subject = '';
        this.message = '';
      },
      error: () => this.sending.set(false),
    });
  }

  readonly faqs = [
    {
      question: 'How do I cancel a meetup?',
      answer: "Open the table from My Tables, tap the meetup, then choose Cancel Reservation. Guests you've invited will be notified automatically.",
    },
    {
      question: 'How does check-in work?',
      answer: "When you arrive at the restaurant, open the dining event and tap Check In. This lets your table's host and guests know you've arrived.",
    },
    {
      question: 'How do I report someone?',
      answer: 'Go to their profile or the dining event, tap the report icon, and choose a reason. Our safety team reviews every report.',
    },
  ];
  openFaqIndex: number | null = null;

  toggleFaq(index: number): void {
    this.openFaqIndex = this.openFaqIndex === index ? null : index;
  }
}
