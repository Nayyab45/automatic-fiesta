import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-subscribe-to-premium-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './subscribe-to-premium-success.page.html',
  styleUrl: './subscribe-to-premium-success.page.scss',
})
export class SubscribeToPremiumSuccessPage extends BasePage {
  readonly pageTitle = "Premium Confirmation";
}
