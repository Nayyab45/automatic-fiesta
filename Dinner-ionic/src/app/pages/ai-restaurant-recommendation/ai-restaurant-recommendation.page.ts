import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { LocationService } from '../../services/location.service';
import { RestaurantDetail, RestaurantService } from '../../services/restaurant.service';

@Component({
  selector: 'app-ai-restaurant-recommendation',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, UserAvatarComponent],
  templateUrl: './ai-restaurant-recommendation.page.html',
  styleUrl: './ai-restaurant-recommendation.page.scss',
})
export class AiRestaurantRecommendationPage extends BasePage {
  readonly pageTitle = 'AI Recommendation';
  readonly cityService = inject(LocationService);
  private readonly restaurantService = inject(RestaurantService);

  readonly recommendation = signal<RestaurantDetail | null>(null);
  readonly loading = signal(true);
  readonly cuisineTags = computed(() => this.recommendation()?.cuisineTags.split(',') ?? []);

  // Server-generated reasons (see /restaurants/recommended in
  // restaurants.js) reflect what actually drove the score -- taste match,
  // distance, rating -- for this specific user, so they're preferred over
  // a generic client-side guess. The fallback only fires for a restaurant
  // fetched some other way (there isn't one on this page today, but it
  // keeps this computed safe if that ever changes).
  readonly reasons = computed(() => {
    const restaurant = this.recommendation();
    if (!restaurant) return [];
    if (restaurant.reasons?.length) return restaurant.reasons;
    const reasons: string[] = [];
    if (restaurant.rating !== null && restaurant.rating >= 4.7) reasons.push(`Top rated in ${restaurant.city}`);
    reasons.push(`Known for ${restaurant.cuisineTags.split(',')[0]}`);
    reasons.push((restaurant.priceTier ?? 0) >= 3 ? 'Great for a special occasion' : 'Easy on the budget');
    return reasons;
  });

  constructor() {
    super();
    void this.loadRecommendation();
  }

  private async loadRecommendation(): Promise<void> {
    // A real GPS fix gives "near me" its actual meaning; if location is
    // denied/unavailable the backend still works, just falling back to the
    // user's manually-set city (same as Discover) -- see recommended() in
    // restaurants.js.
    let coords: { lat: number; lng: number } | undefined;
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      coords = { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      coords = undefined;
    }

    this.restaurantService.recommended(coords).subscribe({
      next: ({ restaurants }) => {
        this.recommendation.set(restaurants[0] ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  viewRestaurant(): void {
    const restaurant = this.recommendation();
    if (restaurant) this.go(`/restaurant-detail/${restaurant.id}`);
  }
}
