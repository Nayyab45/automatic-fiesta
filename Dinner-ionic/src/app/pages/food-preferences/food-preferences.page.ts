import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-food-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './food-preferences.page.html',
  styleUrl: './food-preferences.page.scss',
})
export class FoodPreferencesPage extends BasePage {
  readonly pageTitle = 'Food Preferences';
  private readonly profileService = inject(ProfileService);

  readonly pakistaniFavorites = ['Biryani', 'Karahi', 'Nihari', 'Haleem', 'BBQ', 'Kebabs', 'Handi', 'Qorma', 'Pulao', 'Sajji'];
  readonly regional = ['Punjabi', 'Sindhi', 'Balochi', 'Pashtun', 'Kashmiri'];
  readonly streetFood = ['Chaat', 'Samosa', 'Pakora', 'Gol Gappay', 'Bun Kebab'];
  readonly desserts = ['Kheer', 'Gulab Jamun', 'Jalebi', 'Kulfi', 'Gajar Ka Halwa', 'Rabri'];
  readonly drinks = ['Chai', 'Doodh Patti', 'Kashmiri Chai', 'Lassi', 'Falooda'];

  readonly selectedFoods = signal(new Set<string>());
  readonly submitting = signal(false);

  constructor() {
    super();
    this.profileService.me().subscribe(({ profile }) => this.selectedFoods.set(new Set(profile.favoriteFoods)));
  }

  isSelected(food: string): boolean {
    return this.selectedFoods().has(food);
  }

  toggleChip(food: string): void {
    const next = new Set(this.selectedFoods());
    if (next.has(food)) {
      next.delete(food);
    } else {
      next.add(food);
    }
    this.selectedFoods.set(next);
  }

  continue(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.profileService.setFoodPreferences(Array.from(this.selectedFoods())).subscribe({
      next: () => this.go('/dietary-preferences'),
      error: () => this.go('/dietary-preferences'),
    });
  }
}
