import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-food-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './food-preferences.page.html',
  styleUrl: './food-preferences.page.scss',
})
export class FoodPreferencesPage {
  readonly pageTitle = "Food Preferences";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  toggleChip(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    el.classList.toggle('chip-default');
    el.classList.toggle('chip-selected');
  }
}
