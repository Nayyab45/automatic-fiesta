import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-dining-event-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dining-event-details.page.html',
  styleUrl: './dining-event-details.page.scss',
})
export class DiningEventDetailsPage extends BasePage {
  readonly pageTitle = "Dining Event Details";
}
