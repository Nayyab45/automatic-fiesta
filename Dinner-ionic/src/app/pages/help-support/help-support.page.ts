import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-help-support',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './help-support.page.html',
  styleUrl: './help-support.page.scss',
})
export class HelpSupportPage extends BasePage {
  readonly pageTitle = "Help & Support";

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

  emailSupport(): void {
    window.location.href = 'mailto:support@whatshouldweeat.com';
  }
}
