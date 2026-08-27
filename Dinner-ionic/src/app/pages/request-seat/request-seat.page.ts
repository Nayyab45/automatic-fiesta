import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-request-seat',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './request-seat.page.html',
  styleUrl: './request-seat.page.scss',
})
export class RequestSeatPage extends BasePage {
  readonly pageTitle = 'Request Seat';
  private readonly tableService = inject(DiningTableService);

  readonly table = signal<DiningTable | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
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
  }

  sendRequest(): void {
    const id = this.routeId();
    if (!id || this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.tableService.requestSeat(id).subscribe({
      next: () => this.go(`/request-status/${id}`),
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.message ?? 'Could not send your request. Please try again.');
      },
    });
  }
}
