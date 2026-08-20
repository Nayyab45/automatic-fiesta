import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-detail.page.html',
  styleUrl: './restaurant-detail.page.scss',
})
export class RestaurantDetailPage {
  readonly pageTitle = "Restaurant Detail";
  saved = false;

  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  toggleSave(): void {
    this.saved = !this.saved;
  }

  share(): void {
    const shareData = { title: 'Haveli Restaurant', text: 'Check out Haveli Restaurant', url: window.location.href };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url).catch(() => {});
    }
  }
}
