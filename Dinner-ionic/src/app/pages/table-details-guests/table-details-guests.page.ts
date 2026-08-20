import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-table-details-guests',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './table-details-guests.page.html',
  styleUrl: './table-details-guests.page.scss',
})
export class TableDetailsGuestsPage {
  readonly pageTitle = "Table Details";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  share(): void {
    const shareData = { title: 'Bella Notte', text: 'Join me at Bella Notte', url: window.location.href };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url).catch(() => {});
    }
  }
}
