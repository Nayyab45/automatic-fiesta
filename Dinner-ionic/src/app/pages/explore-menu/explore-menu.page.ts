import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-explore-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './explore-menu.page.html',
  styleUrl: './explore-menu.page.scss',
})
export class ExploreMenuPage {
  readonly pageTitle = "Explore Menu";


  constructor(private router: Router, private location: Location, public cityService: LocationService) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  toggleChip(event: Event): void {
    (event.currentTarget as HTMLElement).classList.toggle('chip-selected');
  }
}
