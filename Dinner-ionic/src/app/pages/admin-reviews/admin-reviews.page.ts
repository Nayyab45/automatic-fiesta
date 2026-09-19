import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { AdminRestaurantReview, AdminService, AdminTableReview } from '../../services/admin.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './admin-reviews.page.html',
  styleUrl: './admin-reviews.page.scss',
})
export class AdminReviewsPage extends BasePage {
  readonly pageTitle = 'Reviews Management';
  private readonly adminService = inject(AdminService);

  readonly tab = signal<'restaurant' | 'event'>('restaurant');
  readonly restaurantReviews = signal<AdminRestaurantReview[]>([]);
  readonly tableReviews = signal<AdminTableReview[]>([]);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly deletingKey = signal<string | null>(null);

  constructor() {
    super();
    let pending = 2;
    const done = () => {
      if (--pending === 0) this.loading.set(false);
    };
    const fail = (err: HttpErrorResponse) => {
      if (err.status === 403) this.forbidden.set(true);
      done();
    };
    this.adminService.restaurantReviews().subscribe({
      next: ({ reviews }) => {
        this.restaurantReviews.set(reviews);
        done();
      },
      error: fail,
    });
    this.adminService.tableReviews().subscribe({
      next: ({ reviews }) => {
        this.tableReviews.set(reviews);
        done();
      },
      error: fail,
    });
  }

  removeRestaurantReview(review: AdminRestaurantReview): void {
    if (this.deletingKey() || !confirm(`Delete ${review.reviewerName}'s review of ${review.restaurantName}?`)) return;
    this.deletingKey.set(`r${review.id}`);
    this.adminService.deleteRestaurantReview(review.id).subscribe({
      next: () => {
        this.deletingKey.set(null);
        this.restaurantReviews.update((list) => list.filter((r) => r.id !== review.id));
      },
      error: () => this.deletingKey.set(null),
    });
  }

  removeTableReview(review: AdminTableReview): void {
    if (this.deletingKey() || !confirm(`Delete ${review.reviewerName}'s review of "${review.tableTitle}"?`)) return;
    this.deletingKey.set(`t${review.id}`);
    this.adminService.deleteTableReview(review.id).subscribe({
      next: () => {
        this.deletingKey.set(null);
        this.tableReviews.update((list) => list.filter((r) => r.id !== review.id));
      },
      error: () => this.deletingKey.set(null),
    });
  }
}
