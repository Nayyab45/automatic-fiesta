import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { RestaurantDetail, RestaurantService } from '../../services/restaurant.service';

@Component({
  selector: 'app-restaurant-direction',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-direction.page.html',
  styleUrl: './restaurant-direction.page.scss',
})
export class RestaurantDirectionPage extends BasePage {
  readonly pageTitle = "Restaurant Direction";
  private readonly restaurantService = inject(RestaurantService);

  readonly restaurant = signal<RestaurantDetail | null>(null);
  readonly loading = signal(true);
  readonly cuisineTags = computed(() => this.restaurant()?.cuisineTags.split(',') ?? []);

  constructor() {
    super();
    const id = this.routeId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.restaurantService.get(id).subscribe({
      next: ({ restaurant }) => {
        this.restaurant.set(restaurant);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
