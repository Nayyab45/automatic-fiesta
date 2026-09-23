import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { DiningTable, DiningTableService, SeatRequest } from '../../services/dining-table.service';

@Component({
  selector: 'app-dining-event-details',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './dining-event-details.page.html',
  styleUrl: './dining-event-details.page.scss',
})
export class DiningEventDetailsPage extends BasePage {
  readonly pageTitle = 'Dining Event Details';
  private readonly tableService = inject(DiningTableService);

  readonly table = signal<DiningTable | null>(null);
  readonly loading = signal(true);
  readonly mySeatRequest = signal<SeatRequest | null>(null);
  readonly responding = signal(false);

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
        // Only a non-host, non-member can have a pending invite worth
        // showing -- a self-request confirms immediately (see
        // POST /:id/seat-requests), so a 'sent' row here only ever means a
        // host-sent invite this person hasn't responded to yet.
        if (!table.isHost && !table.isMember) {
          this.tableService.mySeatRequest(id).subscribe({
            next: ({ seatRequest }) => this.mySeatRequest.set(seatRequest),
            error: () => {},
          });
        }
      },
      error: () => this.loading.set(false),
    });
  }

  respondToInvite(status: 'confirmed' | 'declined'): void {
    const request = this.mySeatRequest();
    if (!request || this.responding()) return;

    this.responding.set(true);
    this.tableService.patchSeatRequest(request.id, status).subscribe({
      next: ({ seatRequest }) => {
        this.mySeatRequest.set(seatRequest);
        this.responding.set(false);
        if (status === 'confirmed') {
          this.table.update((t) => (t ? { ...t, guestCount: t.guestCount + 1, isMember: true } : t));
        }
      },
      error: () => this.responding.set(false),
    });
  }
}
