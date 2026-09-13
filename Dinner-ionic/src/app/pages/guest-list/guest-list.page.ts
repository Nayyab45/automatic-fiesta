import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { TableGuest, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-guest-list',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './guest-list.page.html',
  styleUrl: './guest-list.page.scss',
})
export class GuestListPage extends BasePage {
  readonly pageTitle = 'Guest List';
  private readonly tableService = inject(DiningTableService);

  readonly guests = signal<TableGuest[]>([]);
  readonly loading = signal(true);

  constructor() {
    super();
    const id = this.routeId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.tableService.guests(id).subscribe({
      next: ({ guests }) => {
        this.guests.set(guests);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
