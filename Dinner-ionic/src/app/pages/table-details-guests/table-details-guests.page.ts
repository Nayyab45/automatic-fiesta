import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-table-details-guests',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './table-details-guests.page.html',
  styleUrl: './table-details-guests.page.scss',
})
export class TableDetailsGuestsPage extends BasePage {
  readonly pageTitle = "Table Details";

  share(): void {
    const shareData = { title: 'Bella Notte', text: 'Join me at Bella Notte', url: window.location.href };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url).catch(() => {});
    }
  }
}
