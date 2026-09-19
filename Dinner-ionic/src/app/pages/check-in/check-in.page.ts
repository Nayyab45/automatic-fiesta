import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-check-in',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './check-in.page.html',
  styleUrl: './check-in.page.scss',
})
export class CheckInPage extends BasePage {
  readonly pageTitle = 'Check In';
  private readonly tableService = inject(DiningTableService);

  readonly table = signal<DiningTable | null>(null);
  readonly loading = signal(true);
  readonly checkedIn = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    super();
    const id = this.routeId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.tableService.get(id).subscribe({
      next: ({ table }) => {
        this.table.set(table);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.tableService.myCheckIn(id).subscribe(({ checkIn }) => this.checkedIn.set(!!checkIn && !checkIn.checkedOutAt));
  }

  checkIn(): void {
    const id = this.routeId();
    if (!id) return;
    this.errorMessage.set(null);
    this.tableService.checkIn(id).subscribe({
      next: () => this.checkedIn.set(true),
      error: (err) => this.errorMessage.set(err.error?.message ?? 'Could not check in. Please try again.'),
    });
  }
}
