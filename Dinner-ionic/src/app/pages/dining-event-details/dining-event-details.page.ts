import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-dining-event-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dining-event-details.page.html',
  styleUrl: './dining-event-details.page.scss',
})
export class DiningEventDetailsPage {
  readonly pageTitle = "Dining Event Details";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
