import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-dietary-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dietary-preferences.page.html',
  styleUrl: './dietary-preferences.page.scss',
})
export class DietaryPreferencesPage {
  readonly pageTitle = "Dietary Preferences";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  toggleClass(event: Event, className: string): void {
    (event.currentTarget as HTMLElement).classList.toggle(className);
  }

  selectSpice(event: Event): void {
    const selected = event.currentTarget as HTMLElement;
    const buttons = selected.parentElement?.querySelectorAll('.spice-level-btn') ?? [];
    buttons.forEach((b) => {
      const btn = b as HTMLElement;
      const check = btn.querySelector('.check-icon');
      btn.classList.remove('spice-selected');
      if (check) {
        check.classList.add('text-outline-variant');
        check.classList.remove('text-primary-container');
        check.textContent = 'radio_button_unchecked';
      }
    });
    selected.classList.add('spice-selected');
    const selectedCheck = selected.querySelector('.check-icon');
    if (selectedCheck) {
      selectedCheck.classList.remove('text-outline-variant');
      selectedCheck.classList.add('text-primary-container');
      selectedCheck.textContent = 'radio_button_checked';
    }
  }
}
