import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { DiningTable, TableGuest, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-table-details-guests',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HeaderComponent],
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

  readonly editingBill = signal(false);
  readonly savingBill = signal(false);
  readonly billError = signal<string | null>(null);
  billInput: number | null = null;

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
        this.availableSeats.set(table.seatsAvailable);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.tableService.guests(id).subscribe(({ guests }) => this.guests.set(guests));
  }

  availableSeatSlots(): number[] {
    return Array.from({ length: this.availableSeats() });
  }

  startEditingBill(): void {
    this.billInput = this.table()?.totalBill ?? null;
    this.billError.set(null);
    this.editingBill.set(true);
  }

  cancelEditingBill(): void {
    this.editingBill.set(false);
  }

  submitBill(): void {
    const table = this.table();
    if (!table || this.savingBill()) return;
    if (!this.billInput || this.billInput <= 0) {
      this.billError.set('Enter the total bill amount.');
      return;
    }

    this.savingBill.set(true);
    this.billError.set(null);
    this.tableService.setBill(table.id, this.billInput).subscribe({
      next: ({ table: updated }) => {
        this.table.set(updated);
        this.savingBill.set(false);
        this.editingBill.set(false);
      },
      error: () => {
        this.savingBill.set(false);
        this.billError.set('Could not save the bill. Please try again.');
      },
    });
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
