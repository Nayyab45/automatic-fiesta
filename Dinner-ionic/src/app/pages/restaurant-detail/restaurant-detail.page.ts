import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-detail.page.html',
  styleUrl: './restaurant-detail.page.scss',
})
export class RestaurantDetailPage extends BasePage {
  readonly pageTitle = "Restaurant Detail";
  saved = false;

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
