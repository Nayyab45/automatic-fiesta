import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';

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
}
