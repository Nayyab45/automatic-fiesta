import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { LocationService } from '../../services/location.service';
import { Restaurant, RestaurantService } from '../../services/restaurant.service';

const REGION_CHIPS = ['All', 'Punjab', 'Sindh', 'KPK', 'Continental', 'Desi', 'Street Food'];
// The chip row mixes two different data dimensions from the original design:
// provinces (filter by restaurants.region) and cuisine styles (filter by
// restaurants.cuisine_tags). This maps each chip to the right one and the
// right stored value, since "KPK" isn't how the region is spelled in data.
const REGION_TO_PROVINCE: Record<string, string> = {
  Punjab: 'Punjab',
  Sindh: 'Sindh',
  KPK: 'Khyber Pakhtunkhwa',
};
const PRICE_CHIPS: { label: string; tier: number | null }[] = [
  { label: 'Under 500', tier: 1 },
  { label: '500-1500', tier: 2 },
  { label: '1500-3000', tier: 3 },
  { label: '3000+', tier: 4 },
];

@Component({
  selector: 'app-discover-restaurants',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, UserAvatarComponent],
  templateUrl: './discover-restaurants.page.html',
  styleUrl: './discover-restaurants.page.scss',
})
export class DiscoverRestaurantsPage extends BasePage {
  readonly pageTitle = 'Discover Restaurants';
  readonly cityService = inject(LocationService);
  private readonly restaurantService = inject(RestaurantService);

  readonly regionChips = REGION_CHIPS;
  readonly priceChips = PRICE_CHIPS;
  readonly restaurants = signal<Restaurant[]>([]);
  readonly loading = signal(true);
  readonly savedIds = signal(new Set<number>());

  selectedRegion = 'All';
  selectedPriceTier: number | null = null;
  private minRating: number | null = null;

  constructor() {
    super();
    const params = this.route.snapshot.queryParamMap;
    const cuisine = params.get('cuisine');
    const priceTier = params.get('priceTier');
    const minRating = params.get('minRating');
    if (cuisine) this.selectedRegion = cuisine;
    if (priceTier) this.selectedPriceTier = Number(priceTier);
    if (minRating) this.minRating = Number(minRating);
    this.loadRestaurants();
  }

  private loadRestaurants(): void {
    this.loading.set(true);
    const province = REGION_TO_PROVINCE[this.selectedRegion];
    const cuisine = this.selectedRegion === 'All' || province ? undefined : this.selectedRegion;
    this.restaurantService
      .list({
        city: this.cityService.current(),
        region: province,
        cuisine,
        priceTier: this.selectedPriceTier ?? undefined,
        minRating: this.minRating ?? undefined,
      })
      .subscribe({
        next: ({ restaurants }) => {
          this.restaurants.set(restaurants);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  selectRegion(region: string): void {
    this.selectedRegion = region;
    this.loadRestaurants();
  }

  selectPriceTier(tier: number | null): void {
    this.selectedPriceTier = this.selectedPriceTier === tier ? null : tier;
    this.loadRestaurants();
  }

  popularDishNames(restaurant: Restaurant): string[] {
    return (restaurant.dishes ?? []).map((d) => d.name);
  }

  isSaved(id: number): boolean {
    return this.savedIds().has(id);
  }

  toggleSave(restaurant: Restaurant): void {
    const request$ = this.isSaved(restaurant.id)
      ? this.restaurantService.unsave(restaurant.id)
      : this.restaurantService.save(restaurant.id);

    request$.subscribe(({ saved }) => {
      const next = new Set(this.savedIds());
      if (saved) {
        next.add(restaurant.id);
      } else {
        next.delete(restaurant.id);
      }
      this.savedIds.set(next);
    });
  }
}
