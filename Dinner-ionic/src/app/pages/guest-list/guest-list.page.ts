import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-guest-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './guest-list.page.html',
  styleUrl: './guest-list.page.scss',
})
export class GuestListPage extends BasePage {
  readonly pageTitle = "Guest List";
}
