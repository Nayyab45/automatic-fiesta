import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { LocationService } from '../../services/location.service';
import { SeatRequest, DiningTableService } from '../../services/dining-table.service';

const POLL_INTERVAL_MS = 4000;

@Component({
  selector: 'app-request-status',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './request-status.page.html',
  styleUrl: './request-status.page.scss',
})
export class RequestStatusPage extends BasePage implements OnDestroy {
  readonly pageTitle = 'Request Status';
  readonly cityService = inject(LocationService);
  private readonly tableService = inject(DiningTableService);
  private pollHandle?: ReturnType<typeof setInterval>;

  readonly seatRequest = signal<SeatRequest | null>(null);
  readonly loading = signal(true);

  constructor() {
    super();
    const id = this.routeId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.poll(id);
    this.pollHandle = setInterval(() => this.poll(id), POLL_INTERVAL_MS);
  }

  private poll(id: string): void {
    this.tableService.mySeatRequest(id).subscribe({
      next: ({ seatRequest }) => {
        this.seatRequest.set(seatRequest);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.pollHandle);
  }
}
