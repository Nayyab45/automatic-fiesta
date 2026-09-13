import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-dietary-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './dietary-preferences.page.html',
  styleUrl: './dietary-preferences.page.scss',
})
export class DietaryPreferencesPage extends BasePage {
  readonly pageTitle = 'Dietary Preferences';
  private readonly profileService = inject(ProfileService);

  readonly dietaryNeedsOptions = ['No Preference', 'Vegetarian', 'Halal', 'No Beef', 'No Mutton', 'No Dairy'];
  readonly spiceLevels = ['No Spicy Food', 'Mild Spice', 'Medium Spice', 'Extra Spicy'];

  readonly selectedNeeds = signal(new Set<string>());
  spiceTolerance = '';
  readonly submitting = signal(false);

  constructor() {
    super();
    this.profileService.me().subscribe(({ profile }) => {
      this.selectedNeeds.set(new Set(profile.dietaryNeeds));
      this.spiceTolerance = profile.spiceTolerance ?? '';
    });
  }

  isNeedSelected(need: string): boolean {
    return this.selectedNeeds().has(need);
  }

  toggleNeed(need: string): void {
    const next = new Set(this.selectedNeeds());
    if (next.has(need)) {
      next.delete(need);
    } else {
      next.add(need);
    }
    this.selectedNeeds.set(next);
  }

  selectSpice(level: string): void {
    this.spiceTolerance = level;
  }

  continue(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.profileService.setDietaryPreferences(Array.from(this.selectedNeeds()), this.spiceTolerance).subscribe({
      next: () => this.go('/loading'),
      error: () => this.go('/loading'),
    });
  }
}
