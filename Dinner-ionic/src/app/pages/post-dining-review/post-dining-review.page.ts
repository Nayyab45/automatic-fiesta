import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BasePage } from '../base.page';
import { DiningTableService, RateablePerson } from '../../services/dining-table.service';

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

  // Ratings for fellow attendees -- keyed by user id, separate from the
  // above (which rate the dining experience/restaurant, not the people).
  readonly rateablePeople = signal<RateablePerson[]>([]);
  readonly peopleRatings = signal<Record<number, number>>({});
  readonly peopleComments = signal<Record<number, string>>({});

  constructor() {
    super();
    const id = this.routeId();
    if (id) {
      this.tableService.rateablePeople(id).subscribe({
        next: ({ people }) => {
          this.rateablePeople.set(people);
          this.peopleRatings.set(
            Object.fromEntries(people.filter((p) => p.myRating !== null).map((p) => [p.id, p.myRating as number])),
          );
          this.peopleComments.set(
            Object.fromEntries(people.filter((p) => p.myComment).map((p) => [p.id, p.myComment as string])),
          );
        },
        // Rating people is a bonus on top of the review, not a blocker --
        // an empty list here just means that section renders nothing.
        error: () => {},
      });
    }
  }

  ratePerson(userId: number, score: number): void {
    this.peopleRatings.update((ratings) => ({ ...ratings, [userId]: score }));
  }

  ratingFor(userId: number): number {
    return this.peopleRatings()[userId] ?? 0;
  }

  setComment(userId: number, comment: string): void {
    this.peopleComments.update((comments) => ({ ...comments, [userId]: comment }));
  }

  commentFor(userId: number): string {
    return this.peopleComments()[userId] ?? '';
  }

  submit(): void {
    const id = this.routeId();
    if (!id || this.submitting()) {
      this.go('/my-tables');
      return;
    }

    this.submitting.set(true);
    const review$ = this.tableService.submitReview(id, {
      foodRating: this.foodRating(),
      restaurantRating: this.restaurantRating(),
      conversationRating: this.conversationRating(),
      overallRating: this.overallRating(),
      dineAgain: this.dineAgain ?? '',
      comment: this.comment,
    });

    // Only the ratings the user actually set (or changed) get submitted --
    // an untouched person is left alone rather than force-rated 0.
    const ratings$ = Object.entries(this.peopleRatings()).map(([userId, score]) =>
      this.tableService
        .ratePerson(id, Number(userId), score, this.commentFor(Number(userId)).trim() || undefined)
        .pipe(catchError(() => of(null))),
    );

    forkJoin([review$, ...ratings$]).subscribe({
      next: () => this.go('/my-tables'),
      error: () => this.go('/my-tables'),
    });
  }
}
