import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { Dish, RestaurantDetail, RestaurantService } from '../../services/restaurant.service';

/** The full dish list for one restaurant -- linked from "View Menu" on
 * restaurant-detail, which otherwise only ever shows a horizontal preview
 * strip of a few dishes. Reuses the same GET /restaurants/:id response
 * (already returns every dish, not just the popular ones) rather than a
 * second request. */
@Component({
  selector: 'app-restaurant-menu',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './restaurant-menu.page.html',
  styleUrl: './restaurant-menu.page.scss',
})
export class RestaurantMenuPage extends BasePage {
  readonly pageTitle = 'Restaurant Menu';
  private readonly restaurantService = inject(RestaurantService);

  readonly restaurant = signal<RestaurantDetail | null>(null);
  readonly loading = signal(true);

  readonly dishes = signal<Dish[]>([]);

  constructor() {
    super();
    effect(
      () => {
        const id = this.routeId();
        if (!id) {
          this.loading.set(false);
          return;
        }
        this.loading.set(true);
        this.restaurantService.get(id).subscribe({
          next: ({ restaurant }) => {
            this.restaurant.set(restaurant);
            this.dishes.set(restaurant.dishes);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      { allowSignalWrites: true },
    );
  }
}
