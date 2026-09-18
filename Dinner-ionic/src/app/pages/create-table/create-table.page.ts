import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { Restaurant, RestaurantService } from '../../services/restaurant.service';
import { DiningTableService, TableAudience } from '../../services/dining-table.service';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-create-table',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HeaderComponent],
  templateUrl: './create-table.page.html',
  styleUrl: './create-table.page.scss',
})
export class CreateTablePage extends BasePage {
  readonly pageTitle = 'Create Table';
  private readonly restaurantService = inject(RestaurantService);
  private readonly tableService = inject(DiningTableService);
  private readonly profileService = inject(ProfileService);

  readonly gatheringTypes = ['Dinner', 'Lunch', 'Brunch', 'Chai Meetup'];
  readonly atmospheres = ['Casual Dinner', 'Social Conversation', 'Business Networking'];
  readonly audienceOptions: { value: TableAudience; label: string }[] = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'women_only', label: 'Women only' },
    { value: 'friends_only', label: 'Friends only' },
  ];
  readonly restaurants = signal<Restaurant[]>([]);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** True for an active Premium subscription -- eventsRemaining is
   * meaningless in that case (see Backend/src/routes/tables.js). */
  readonly eventsUnlimited = signal(false);
  /** null while unknown or unlimited; otherwise how many free-tier events
   * are left this month. */
  readonly eventsRemaining = signal<number | null>(null);

  gatheringType = 'Dinner';
  atmosphere = 'Social Conversation';
  restaurantId: number | null = null;
  date = '';
  time = '';
  seatsTotal = 4;
  visibility = true;
  // Only meaningful while visibility is public -- a private table is already
  // invite-only regardless of audience (see Backend/src/routes/tables.js).
  audience: TableAudience = 'everyone';
  note = '';

  constructor() {
    super();
    const restaurantIdParam = this.route.snapshot.queryParamMap.get('restaurantId');
    this.restaurantId = restaurantIdParam ? Number(restaurantIdParam) : null;
    this.restaurantService.list().subscribe(({ restaurants }) => {
      this.restaurants.set(restaurants);
      if (!this.restaurantId && restaurants.length > 0) {
        this.restaurantId = restaurants[0].id;
      }
    });
    this.profileService.me().subscribe(({ tableCreation }) => {
      this.eventsUnlimited.set(tableCreation.unlimited);
      this.eventsRemaining.set(tableCreation.unlimited ? null : tableCreation.remaining);
    });
  }

  selectGatheringType(type: string): void {
    this.gatheringType = type;
  }

  selectAtmosphere(atmosphere: string): void {
    this.atmosphere = atmosphere;
  }

  submit(): void {
    if (!this.restaurantId || !this.date || !this.time || this.submitting()) {
      this.errorMessage.set('Please pick a restaurant, date, and time.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.tableService
      .create({
        restaurantId: this.restaurantId,
        gatheringType: this.gatheringType,
        dateTime: `${this.date}T${this.time}`,
        seatsTotal: this.seatsTotal,
        visibility: this.visibility ? 'public' : 'private',
        audience: this.visibility ? this.audience : 'everyone',
        atmosphere: this.atmosphere,
        note: this.note,
      })
      .subscribe({
        next: ({ table }) => this.go(`/guest-list/${table.id}`),
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          if (err.status === 429) {
            this.eventsRemaining.set(0);
            this.errorMessage.set(err.error?.message ?? "You've used your free events for this month.");
            return;
          }
          this.errorMessage.set('Could not create the table. Please try again.');
        },
      });
  }
}
