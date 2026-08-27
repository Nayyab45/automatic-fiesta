import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './search-filter.page.html',
  styleUrl: './search-filter.page.scss',
})
export class SearchFilterPage extends BasePage {
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
  readonly cityService = inject(LocationService);

  /**
   * Open a native date/time picker.
   *
   * `showPicker()` is missing on older Android WebViews and Safari < 16, so it
   * has to be feature-detected -- but the DOM typings declare it as always
   * present, which strictTemplates (rightly) flags as a condition that is
   * always true. Hence the runtime `typeof` check here rather than in the
   * template. It can also throw if the call is not tied to a user gesture, so
   * fall back to `click()` either way.
   */
  openPicker(input: HTMLInputElement): void {
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        /* not allowed in this context -- fall through to the click fallback */
      }
    }
    input.click();
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
