import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { DiningTable, SeatRequest, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-manage-seat-requests',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './manage-seat-requests.page.html',
  styleUrl: './manage-seat-requests.page.scss',
})
export class ManageSeatRequestsPage extends BasePage {
  readonly pageTitle = 'Manage Requests';
  private readonly tableService = inject(DiningTableService);

  readonly table = signal<DiningTable | null>(null);
  readonly requests = signal<SeatRequest[]>([]);
  readonly loading = signal(true);
  // Only one request can be mid-flight at a time -- disables every
  // accept/decline button while its own PATCH is in the air, rather than
  // letting a double-tap fire two conflicting requests.
  readonly actioningId = signal<number | null>(null);

  readonly pending = computed(() => this.requests().filter((r) => r.status === 'sent'));
  readonly resolved = computed(() => this.requests().filter((r) => r.status !== 'sent'));

  constructor() {
    super();
    const id = this.routeId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.tableService.get(id).subscribe({ next: ({ table }) => this.table.set(table) });
    this.tableService.seatRequests(id).subscribe({
      next: ({ seatRequests }) => {
        this.requests.set(seatRequests);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  respond(request: SeatRequest, status: 'confirmed' | 'declined'): void {
    if (this.actioningId()) return;
    this.actioningId.set(request.id);
    this.tableService.patchSeatRequest(request.id, status).subscribe({
      next: ({ seatRequest }) => {
        this.requests.update((list) =>
          list.map((r) => (r.id === seatRequest.id ? { ...r, status: seatRequest.status } : r)),
        );
        // Confirming seats the guest immediately -- reflect that in the
        // header's seat count without waiting on a full table refetch.
        if (status === 'confirmed') {
          this.table.update((t) => (t ? { ...t, guestCount: t.guestCount + 1 } : t));
        }
        this.actioningId.set(null);
      },
      error: () => this.actioningId.set(null),
    });
  }
}
