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

  readonly priceTiers = ['Rs', 'Rs Rs', 'Rs Rs Rs', 'Rs Rs Rs Rs'];
  readonly stars = [1, 2, 3, 4, 5];

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
  priceTierIndex: number | null = null;
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

  selectPriceTier(index: number): void {
    this.priceTierIndex = this.priceTierIndex === index ? null : index;
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
    this.priceTierIndex = null;
    this.ratingValue = null;
    this.guestCount = 2;
  }

  showResults(): void {
    const params = new URLSearchParams();
    if (this.searchQuery.trim()) params.set('query', this.searchQuery.trim());
    if (this.selectedCuisines.size) params.set('cuisine', [...this.selectedCuisines].join(','));
    if (this.priceTierIndex !== null) params.set('priceTier', String(this.priceTierIndex + 1));
    if (this.ratingValue !== null) params.set('minRating', String(this.ratingValue));
    this.go(`/discover-restaurants?${params.toString()}`);
  }
}
