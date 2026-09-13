import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-post-dining-review',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HeaderComponent],
  templateUrl: './post-dining-review.page.html',
  styleUrl: './post-dining-review.page.scss',
})
export class PostDiningReviewPage extends BasePage {
  readonly pageTitle = 'Post-Dining Review';
  private readonly tableService = inject(DiningTableService);

  readonly stars = [1, 2, 3, 4, 5];
  readonly foodRating = signal(0);
  readonly restaurantRating = signal(0);
  readonly conversationRating = signal(0);
  readonly overallRating = signal(0);
  dineAgain: string | null = null;
  comment = '';
  readonly submitting = signal(false);

  submit(): void {
    const id = this.routeId();
    if (!id || this.submitting()) {
      this.go('/my-tables');
      return;
    }

    this.submitting.set(true);
    this.tableService
      .submitReview(id, {
        foodRating: this.foodRating(),
        restaurantRating: this.restaurantRating(),
        conversationRating: this.conversationRating(),
        overallRating: this.overallRating(),
        dineAgain: this.dineAgain ?? '',
        comment: this.comment,
      })
      .subscribe({
        next: () => this.go('/my-tables'),
        error: () => this.go('/my-tables'),
      });
  }
}
