import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RootHeaderComponent } from '../../components/root-header/root-header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { LocationService } from '../../services/location.service';
import { googleMapsUrl, Restaurant, RestaurantService } from '../../services/restaurant.service';

// Province chips are static (they map onto restaurants.region, whose values
// are fixed). Cuisine chips are NOT static -- restaurants.cuisine_tags is
// freeform text from OpenStreetMap (see osmPlaces.js), so a hardcoded list
// like "Continental"/"Desi"/"Street Food" mostly wouldn't match anything.
// They're fetched per-city from RestaurantService.cuisines() instead.
const BASE_CHIPS = ['All', 'Punjab', 'Sindh', 'KPK'];
// The chip row mixes two different data dimensions from the original design:
// provinces (filter by restaurants.region) and cuisine styles (filter by
// restaurants.cuisine_tags). This maps each chip to the right one and the
// right stored value, since "KPK" isn't how the region is spelled in data.
const REGION_TO_PROVINCE: Record<string, string> = {
  Punjab: 'Punjab',
  Sindh: 'Sindh',
  KPK: 'Khyber Pakhtunkhwa',
};
// A dropdown of common PKR ranges that fills in the two editable number
// fields next to it -- see search-filter.page.ts's own copy of this same
// preset list (kept independent since each page's price control is its own
// component, not shared).
const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Any price', min: null, max: null },
  { label: 'Under Rs 500', min: null, max: 500 },
  { label: 'Rs 500 - 1500', min: 500, max: 1500 },
  { label: 'Rs 1500 - 3000', min: 1500, max: 3000 },
  { label: 'Rs 3000+', min: 3000, max: null },
];

@Component({
  selector: 'app-discover-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BottomNavComponent, UserAvatarComponent, RootHeaderComponent],
  templateUrl: './discover-restaurants.page.html',
  styleUrl: './discover-restaurants.page.scss',
})
export class DiscoverRestaurantsPage extends BasePage {
  readonly pageTitle = 'Discover Restaurants';
  readonly cityService = inject(LocationService);
  private readonly restaurantService = inject(RestaurantService);

  readonly regionChips = signal<string[]>(BASE_CHIPS);
  readonly pricePresets = PRICE_PRESETS;
  readonly restaurants = signal<Restaurant[]>([]);
  readonly loading = signal(true);
  readonly savedIds = signal(new Set<number>());

  selectedRegion = 'All';
  selectedPricePreset = 0;
  minPrice: number | null = null;
  maxPrice: number | null = null;
  private minRating: number | null = null;
  // Set only when arriving from the search box on search-filter.page --
  // narrows results by restaurant name in addition to the other filters
  // rather than replacing them, matching how the backend's `query` param
  // combines with city/region/cuisine/etc.
  readonly searchQuery = signal<string | null>(null);

  constructor() {
    super();
    const params = this.route.snapshot.queryParamMap;
    const cuisine = params.get('cuisine');
    const minPrice = params.get('minPrice');
    const maxPrice = params.get('maxPrice');
    const minRating = params.get('minRating');
    const query = params.get('query');
    if (cuisine) this.selectedRegion = cuisine;
    if (minPrice) this.minPrice = Number(minPrice);
    if (maxPrice) this.maxPrice = Number(maxPrice);
    if (minRating) this.minRating = Number(minRating);
    if (query) this.searchQuery.set(query);
    this.loadCuisineChips();

    // ion-router-outlet keeps a previously-visited page's component alive
    // instead of destroying it, so navigating away to /select-location and
    // back reuses this same instance -- the constructor (and its one-time
    // loadRestaurants() call) never runs again. Reacting to the city signal
    // itself instead means picking a different city reloads immediately,
    // regardless of whether this component is fresh or being reused; this
    // also covers the initial load, so there's no separate call needed
    // outside the effect.
    effect(
      () => {
        this.cityService.current();
        this.loadRestaurants();
      },
      { allowSignalWrites: true },
    );
  }

  private loadCuisineChips(): void {
    this.restaurantService.cuisines(this.cityService.current()).subscribe({
      next: ({ cuisines }) => this.regionChips.set([...BASE_CHIPS, ...cuisines]),
      error: () => {},
    });
  }

  private loadRestaurants(): void {
    this.loading.set(true);
    const searching = !!this.searchQuery();
    const province = REGION_TO_PROVINCE[this.selectedRegion];
    const cuisine = this.selectedRegion === 'All' || province ? undefined : this.selectedRegion;
    this.restaurantService
      .list({
        // A name search looks for that restaurant everywhere, not just the
        // city currently being browsed -- someone searching "Kolachi"
        // almost certainly doesn't know (or care) which city it's filed
        // under, and ANDing the search with that ambient city filter
        // silently returned zero results instead of the restaurant they
        // were looking for. Region/cuisine are different: those are filters
        // the person deliberately chose (a province chip here, or a cuisine
        // chip on search-filter.page alongside its search box), so a search
        // still combines with them same as before -- only the current city,
        // which nothing on screen suggests is part of this search, drops
        // out. A province chip still browses that whole province rather
        // than just the currently selected city -- city and region both
        // narrow by location and every city implies exactly one region, so
        // sending both ANDs them together and returns nothing unless the
        // city happens to already be in that province.
        city: searching || province ? undefined : this.cityService.current(),
        region: province,
        cuisine,
        minPrice: this.minPrice ?? undefined,
        maxPrice: this.maxPrice ?? undefined,
        minRating: this.minRating ?? undefined,
        query: this.searchQuery() ?? undefined,
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

  applyPricePreset(index: number): void {
    this.selectedPricePreset = index;
    const preset = this.pricePresets[index];
    this.minPrice = preset.min;
    this.maxPrice = preset.max;
    this.loadRestaurants();
  }

  applyPriceInputs(): void {
    this.loadRestaurants();
  }

  clearSearch(): void {
    this.searchQuery.set(null);
    this.loadRestaurants();
  }

  popularDishNames(restaurant: Restaurant): string[] {
    return (restaurant.dishes ?? []).map((d) => d.name);
  }

  mapsUrl(restaurant: Restaurant): string {
    return googleMapsUrl(restaurant);
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
