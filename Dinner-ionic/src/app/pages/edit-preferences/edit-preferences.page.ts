import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BasePage } from '../base.page';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-edit-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './edit-preferences.page.html',
  styleUrl: './edit-preferences.page.scss',
})
export class EditPreferencesPage extends BasePage {
  readonly pageTitle = 'Edit Preferences';
  private readonly profileService = inject(ProfileService);

  readonly cuisines = ['Punjabi', 'Sindhi', 'Peshawari', 'Balochi', 'Mughlai', 'Kashmiri'];
  readonly spiceOptions = ['Mild', 'Medium', 'Spicy'];
  readonly dietaryOptions = ['Halal (Strict)', 'Vegetarian', 'Gluten-Free Options'];
  readonly diningTimeOptions = ['Lunch', 'Dinner', 'Late Night'];

  readonly selectedCuisines = signal(new Set<string>());
  readonly selectedDietary = signal(new Set<string>());
  readonly selectedDiningTimes = signal(new Set<string>());
  spice = 'Medium';
  maxDistanceKm = 15;
  readonly submitting = signal(false);
  /** Dish-level favorites from the food-preferences step, preserved on save
   *  since this page's cuisine chips share the same favoriteFoods field. */
  private nonCuisineFoods: string[] = [];
  /** Same sharing concern for dietary_preferences.needs against the
   *  dietary-preferences step's broader option set. */
  private otherDietaryNeeds: string[] = [];

  constructor() {
    super();
    this.profileService.me().subscribe(({ profile }) => {
      this.nonCuisineFoods = profile.favoriteFoods.filter((f) => !this.cuisines.includes(f));
      this.selectedCuisines.set(new Set(profile.favoriteFoods.filter((f) => this.cuisines.includes(f))));
      this.otherDietaryNeeds = profile.dietaryNeeds.filter((n) => !this.dietaryOptions.includes(n));
      this.selectedDietary.set(new Set(profile.dietaryNeeds.filter((n) => this.dietaryOptions.includes(n))));
      if (profile.spiceTolerance && this.spiceOptions.includes(profile.spiceTolerance)) {
        this.spice = profile.spiceTolerance;
      }
      this.maxDistanceKm = profile.maxDistanceKm ?? 15;
      this.selectedDiningTimes.set(new Set(profile.diningTimes.filter((t) => this.diningTimeOptions.includes(t))));
    });
  }

  isCuisineSelected(cuisine: string): boolean {
    return this.selectedCuisines().has(cuisine);
  }

  toggleCuisine(cuisine: string): void {
    const next = new Set(this.selectedCuisines());
    if (next.has(cuisine)) {
      next.delete(cuisine);
    } else {
      next.add(cuisine);
    }
    this.selectedCuisines.set(next);
  }

  selectSpice(spice: string): void {
    this.spice = spice;
  }

  isDietarySelected(option: string): boolean {
    return this.selectedDietary().has(option);
  }

  toggleDietary(option: string): void {
    const next = new Set(this.selectedDietary());
    if (next.has(option)) {
      next.delete(option);
    } else {
      next.add(option);
    }
    this.selectedDietary.set(next);
  }

  isDiningTimeSelected(time: string): boolean {
    return this.selectedDiningTimes().has(time);
  }

  toggleDiningTime(time: string): void {
    const next = new Set(this.selectedDiningTimes());
    if (next.has(time)) {
      next.delete(time);
    } else {
      next.add(time);
    }
    this.selectedDiningTimes.set(next);
  }

  onDistanceChange(event: Event): void {
    this.maxDistanceKm = Number((event.target as HTMLInputElement).value);
  }

  save(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    forkJoin([
      this.profileService.setFoodPreferences([...this.nonCuisineFoods, ...this.selectedCuisines()]),
      this.profileService.setDietaryPreferences([...this.otherDietaryNeeds, ...this.selectedDietary()], this.spice),
      this.profileService.setMatchPreferences(this.maxDistanceKm, Array.from(this.selectedDiningTimes())),
    ]).subscribe({
      next: () => this.go('/profile'),
      error: () => {
        this.submitting.set(false);
      },
    });
  }
}
