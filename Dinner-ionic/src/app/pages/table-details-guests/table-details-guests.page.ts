import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { DiningTable, TableGuest, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-table-details-guests',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './table-details-guests.page.html',
  styleUrl: './table-details-guests.page.scss',
})
export class TableDetailsGuestsPage extends BasePage {
  readonly pageTitle = 'Table Details';
  private readonly tableService = inject(DiningTableService);

  readonly table = signal<DiningTable | null>(null);
  readonly guests = signal<TableGuest[]>([]);
  readonly loading = signal(true);
  readonly availableSeats = signal(0);

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
        this.availableSeats.set(Math.max(table.seatsTotal - table.guestCount, 0));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.tableService.guests(id).subscribe(({ guests }) => this.guests.set(guests));
  }

  availableSeatSlots(): number[] {
    return Array.from({ length: this.availableSeats() });
  }

  share(): void {
    const table = this.table();
    if (!table) return;
    const shareData = { title: table.restaurant.name, text: `Join me at ${table.restaurant.name}`, url: window.location.href };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url).catch(() => {});
    }
  }
}
