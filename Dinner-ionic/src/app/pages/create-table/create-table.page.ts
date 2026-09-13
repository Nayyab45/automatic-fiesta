import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { Restaurant, RestaurantService } from '../../services/restaurant.service';
import { DiningTableService } from '../../services/dining-table.service';

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

  readonly gatheringTypes = ['Dinner', 'Lunch', 'Brunch', 'Chai Meetup'];
  readonly atmospheres = ['Casual Dinner', 'Social Conversation', 'Business Networking'];
  readonly restaurants = signal<Restaurant[]>([]);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  gatheringType = 'Dinner';
  atmosphere = 'Social Conversation';
  restaurantId: number | null = null;
  date = '';
  time = '';
  seatsTotal = 4;
  visibility = true;
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
        atmosphere: this.atmosphere,
        note: this.note,
      })
      .subscribe({
        next: ({ table }) => this.go(`/guest-list/${table.id}`),
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('Could not create the table. Please try again.');
        },
      });
  }
}
