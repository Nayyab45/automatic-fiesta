import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-premium-members',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './premium-members.page.html',
  styleUrl: './premium-members.page.scss',
})
export class PremiumMembersPage extends BasePage {
  readonly pageTitle = "Premium Membership";
}
