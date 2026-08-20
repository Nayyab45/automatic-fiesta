import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-discover-restaurants',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './discover-restaurants.page.html',
  styleUrl: './discover-restaurants.page.scss',
})
export class DiscoverRestaurantsPage {
  readonly pageTitle = "Discover Restaurants";


  constructor(private router: Router, private location: Location, public cityService: LocationService) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

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
