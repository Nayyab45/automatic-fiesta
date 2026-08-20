import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './search-filter.page.html',
  styleUrl: './search-filter.page.scss',
})
export class SearchFilterPage {
  readonly pageTitle = "Search & Filter";

  readonly cuisines = ['Punjabi', 'Sindhi', 'Peshawari', 'Balochi', 'Kashmiri', 'Mughlai', 'Karachi Street'];
  readonly priceTiers = ['Rs', 'Rs Rs', 'Rs Rs Rs', 'Rs Rs Rs Rs'];
  readonly stars = [1, 2, 3, 4, 5];

  selectedCuisines = new Set<string>(['Sindhi']);
  priceTierIndex = 1;
  ratingValue = 4;
  guestCount = 2;
  selectedDate = 'Today, Oct 24';
  selectedTime = '20:00';

  constructor(private router: Router, private location: Location, public cityService: LocationService) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  toggleCuisine(name: string): void {
    if (this.selectedCuisines.has(name)) {
      this.selectedCuisines.delete(name);
    } else {
      this.selectedCuisines.add(name);
    }
  }

  selectPriceTier(index: number): void {
    this.priceTierIndex = index;
  }

  setRating(value: number): void {
    this.ratingValue = value;
  }

  incrementGuests(): void {
    this.guestCount = Math.min(this.guestCount + 1, 20);
  }

  decrementGuests(): void {
    this.guestCount = Math.max(this.guestCount - 1, 1);
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    this.selectedDate = new Date(value + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  onTimeChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.selectedTime = value;
  }

  resetFilters(): void {
    this.selectedCuisines = new Set<string>();
    this.priceTierIndex = 1;
    this.ratingValue = 4;
    this.guestCount = 2;
    this.selectedDate = 'Today, Oct 24';
    this.selectedTime = '20:00';
  }
}
