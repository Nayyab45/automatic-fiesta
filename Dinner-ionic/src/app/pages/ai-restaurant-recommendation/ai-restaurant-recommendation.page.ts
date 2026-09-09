import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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

  readonly reasons = computed(() => {
    const restaurant = this.recommendation();
    if (!restaurant) return [];
    const reasons: string[] = [];
    if (restaurant.rating !== null && restaurant.rating >= 4.7) reasons.push(`Top rated in ${restaurant.city}`);
    reasons.push(`Known for ${restaurant.cuisineTags.split(',')[0]}`);
    reasons.push((restaurant.priceTier ?? 0) >= 3 ? 'Great for a special occasion' : 'Easy on the budget');
    return reasons;
  });

  constructor() {
    super();
    this.restaurantService.recommended().subscribe({
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
