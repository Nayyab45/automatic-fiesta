import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { AdmobService } from '../../services/admob.service';
import { googleMapsUrl, Restaurant, RestaurantService } from '../../services/restaurant.service';

@Component({
  selector: 'app-saved-restaurants',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './saved-restaurants.page.html',
  styleUrl: './saved-restaurants.page.scss',
})
export class SavedRestaurantsPage extends BasePage {
  readonly pageTitle = 'Saved Restaurants';
  private readonly restaurantService = inject(RestaurantService);
  private readonly admob = inject(AdmobService);

  readonly restaurants = signal<Restaurant[]>([]);
  readonly loading = signal(true);

  constructor() {
    super();
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.restaurantService.saved().subscribe({
      next: ({ restaurants }) => {
        this.restaurants.set(restaurants);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  mapsUrl(restaurant: Restaurant): string {
    return googleMapsUrl(restaurant);
  }

  unsave(restaurant: Restaurant): void {
    this.restaurantService.unsave(restaurant.id).subscribe(() => {
      this.restaurants.update((list) => list.filter((r) => r.id !== restaurant.id));
    });
  }

  // Opens the Send Request form. Shows the interstitial on the tap itself
  // (cooldown ignored, per product decision); no-op for ad-free tiers or if
  // none is loaded yet, and never delays the navigation.
  sendRequest(restaurantId: number | undefined): void {
    this.admob.showInterstitial({ ignoreCooldown: true });
    this.go('/create-table?restaurantId=' + restaurantId);
  }
}
