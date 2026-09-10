import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { DiningTable, Review, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-table-reviews',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './table-reviews.page.html',
  styleUrl: './table-reviews.page.scss',
})
export class TableReviewsPage extends BasePage {
  readonly pageTitle = 'Reviews';
  private readonly tableService = inject(DiningTableService);

  readonly stars = [1, 2, 3, 4, 5];
  readonly table = signal<DiningTable | null>(null);
  readonly reviews = signal<Review[]>([]);
  readonly loading = signal(true);
  // Distinguishes "you're not allowed to see this" from "no reviews yet" --
  // the backend 403s a non-member rather than returning an empty list.
  readonly forbidden = signal(false);

  readonly averageRating = computed(() => {
    const list = this.reviews();
    if (list.length === 0) return null;
    return Math.round((list.reduce((sum, r) => sum + r.overallRating, 0) / list.length) * 10) / 10;
  });

  constructor() {
    super();
    const id = this.routeId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.tableService.get(id).subscribe({ next: ({ table }) => this.table.set(table) });
    this.tableService.reviews(id).subscribe({
      next: ({ reviews }) => {
        this.reviews.set(reviews);
        this.loading.set(false);
      },
      error: (err) => {
        if (err.status === 403) this.forbidden.set(true);
        this.loading.set(false);
      },
    });
  }

  dineAgainLabel(value: string): string {
    return { yes: 'Would dine again', maybe: 'Might dine again', no: "Wouldn't dine again" }[value] ?? '';
  }
}
