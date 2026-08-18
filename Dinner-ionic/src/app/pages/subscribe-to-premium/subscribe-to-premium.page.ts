import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-subscribe-to-premium',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './subscribe-to-premium.page.html',
  styleUrl: './subscribe-to-premium.page.scss',
})
export class SubscribeToPremiumPage {
  readonly pageTitle = "Subscribe to Premium";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
