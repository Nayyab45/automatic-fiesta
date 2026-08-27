import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { RestaurantDetail, RestaurantService } from '../../services/restaurant.service';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-detail.page.html',
  styleUrl: './restaurant-detail.page.scss',
})
export class RestaurantDetailPage extends BasePage {
  readonly pageTitle = 'Restaurant Detail';
  private readonly restaurantService = inject(RestaurantService);

  readonly restaurant = signal<RestaurantDetail | null>(null);
  readonly loading = signal(true);
  saved = false;

  readonly cuisineTags = computed(() => this.restaurant()?.cuisineTags.split(',') ?? []);

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
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      { allowSignalWrites: true },
    );
  }

  toggleSave(): void {
    const restaurant = this.restaurant();
    if (!restaurant) return;
    const request$ = this.saved ? this.restaurantService.unsave(restaurant.id) : this.restaurantService.save(restaurant.id);
    request$.subscribe(({ saved }) => (this.saved = saved));
  }

  share(): void {
    const restaurant = this.restaurant();
    if (!restaurant) return;
    const shareData = { title: restaurant.name, text: `Check out ${restaurant.name}`, url: window.location.href };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url).catch(() => {});
    }
  }
}
