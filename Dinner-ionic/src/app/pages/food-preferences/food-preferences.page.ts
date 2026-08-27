import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-food-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './food-preferences.page.html',
  styleUrl: './food-preferences.page.scss',
})
export class FoodPreferencesPage extends BasePage {
  readonly pageTitle = "Food Preferences";

  toggleChip(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    el.classList.toggle('chip-default');
    el.classList.toggle('chip-selected');
  }
}
