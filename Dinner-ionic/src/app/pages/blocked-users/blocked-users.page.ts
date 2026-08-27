import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-blocked-users',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blocked-users.page.html',
  styleUrl: './blocked-users.page.scss',
})
export class BlockedUsersPage extends BasePage {
  readonly pageTitle = "Blocked Users";
}
