import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-discover-restaurants',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './discover-restaurants.page.html',
  styleUrl: './discover-restaurants.page.scss',
})
export class DiscoverRestaurantsPage extends BasePage {
  readonly pageTitle = "Discover Restaurants";
  readonly cityService = inject(LocationService);

  selectFilterChip(event: Event): void {
    const selected = event.currentTarget as HTMLElement;
    const group = selected.parentElement?.querySelectorAll('.filter-chip') ?? [];
    group.forEach((chip) => chip.classList.remove('filter-chip-selected'));
    selected.classList.add('filter-chip-selected');
  }

  toggleSave(event: Event): void {
    const btn = event.currentTarget as HTMLElement;
    const icon = btn.querySelector('.material-symbols-outlined');
    if (!icon) return;
    const isSaved = icon.textContent?.trim() === 'bookmark';
    icon.textContent = isSaved ? 'bookmark_border' : 'bookmark';
    icon.classList.toggle('text-primary', !isSaved);
  }
}
