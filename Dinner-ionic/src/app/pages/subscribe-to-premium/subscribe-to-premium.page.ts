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
  readonly subtotal = 9.99;
  promoMessage = '';
  discount = 0;

  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  get total(): number {
    return Math.max(this.subtotal - this.discount, 0);
  }

  applyPromo(input: HTMLInputElement): void {
    const code = input.value.trim().toUpperCase();
    if (!code) return;
    if (code === 'DASTARKHAN10') {
      this.discount = 1;
      this.promoMessage = 'Promo applied: $1.00 off';
    } else {
      this.discount = 0;
      this.promoMessage = 'Invalid promo code';
    }
  }
}
