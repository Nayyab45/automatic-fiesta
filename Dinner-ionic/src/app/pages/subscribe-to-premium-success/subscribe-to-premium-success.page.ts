import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-subscribe-to-premium-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './subscribe-to-premium-success.page.html',
  styleUrl: './subscribe-to-premium-success.page.scss',
})
export class SubscribeToPremiumSuccessPage {
  readonly pageTitle = "Premium Confirmation";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
