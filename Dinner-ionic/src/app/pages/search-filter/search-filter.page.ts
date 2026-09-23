import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { LocationService } from '../../services/location.service';
import { RestaurantService } from '../../services/restaurant.service';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BottomNavComponent, UserAvatarComponent],
  templateUrl: './search-filter.page.html',
  styleUrl: './search-filter.page.scss',
})
export class SearchFilterPage extends BasePage {
  readonly pageTitle = "Search & Filter";

  readonly stars = [1, 2, 3, 4, 5];

  // A dropdown of common PKR ranges that fills in the two editable number
  // fields below it -- picking one is a shortcut, not a constraint; either
  // field can still be typed into afterward (e.g. "3000+" then narrowed to
  // a max of 5000).
  readonly pricePresets: { label: string; min: number | null; max: number | null }[] = [
    { label: 'Any price', min: null, max: null },
    { label: 'Under Rs 500', min: null, max: 500 },
    { label: 'Rs 500 - 1500', min: 500, max: 1500 },
    { label: 'Rs 1500 - 3000', min: 1500, max: 3000 },
    { label: 'Rs 3000+', min: 3000, max: null },
  ];
  selectedPricePreset = 0;
  minPrice: number | null = null;
  maxPrice: number | null = null;

  // Wired to the free-text box at the top of this page -- it used to render
  // with no binding at all, so anything typed there was silently discarded
  // and only the chip/tier/rating filters below it ever reached the backend.
  searchQuery = '';

  // Cuisine chips are the cuisine_tags that actually occur for this city
  // (freeform text imported from OpenStreetMap -- see osmPlaces.js), fetched
  // below rather than hardcoded, since a curated list like "Punjabi"/"Sindhi"
  // mostly wouldn't match any real restaurant.
  readonly cuisines = signal<string[]>([]);
  selectedCuisines = new Set<string>();
  // null means "no filter chosen" -- these used to default to a specific
  // tier/rating and get sent regardless of whether the user touched them,
  // which silently filtered out most results.
  ratingValue: number | null = null;
  guestCount = 2;
  readonly cityService = inject(LocationService);
  private readonly restaurantService = inject(RestaurantService);

  constructor() {
    super();
    this.restaurantService.cuisines(this.cityService.current()).subscribe({
      next: ({ cuisines }) => this.cuisines.set(cuisines),
      error: () => {},
    });
  }

  toggleCuisine(name: string): void {
    if (this.selectedCuisines.has(name)) {
      this.selectedCuisines.delete(name);
    } else {
      this.selectedCuisines.add(name);
    }
  }

  applyPricePreset(index: number): void {
    this.selectedPricePreset = index;
    const preset = this.pricePresets[index];
    this.minPrice = preset.min;
    this.maxPrice = preset.max;
  }

  setRating(value: number): void {
    this.ratingValue = this.ratingValue === value ? null : value;
  }

  incrementGuests(): void {
    this.guestCount = Math.min(this.guestCount + 1, 20);
  }

  decrementGuests(): void {
    this.guestCount = Math.max(this.guestCount - 1, 1);
  }

  resetFilters(): void {
    this.selectedCuisines = new Set<string>();
    this.applyPricePreset(0);
    this.ratingValue = null;
    this.guestCount = 2;
  }

  showResults(): void {
    const params = new URLSearchParams();
    if (this.searchQuery.trim()) params.set('query', this.searchQuery.trim());
    if (this.selectedCuisines.size) params.set('cuisine', [...this.selectedCuisines].join(','));
    if (this.minPrice !== null) params.set('minPrice', String(this.minPrice));
    if (this.maxPrice !== null) params.set('maxPrice', String(this.maxPrice));
    if (this.ratingValue !== null) params.set('minRating', String(this.ratingValue));
    this.go(`/discover-restaurants?${params.toString()}`);
  }
}
