import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-payment-methods',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './payment-methods.page.html',
  styleUrl: './payment-methods.page.scss',
})
export class PaymentMethodsPage {
  readonly pageTitle = 'Payment Methods';

  showAddCard = false;
  cardNumber = '';
  cardExpiry = '';

  constructor(
    private router: Router,
    private location: Location,
    public paymentService: PaymentService,
  ) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  openAddCard(): void {
    this.showAddCard = true;
  }

  cancelAddCard(): void {
    this.showAddCard = false;
    this.cardNumber = '';
    this.cardExpiry = '';
  }

  saveCard(): void {
    const digits = this.cardNumber.replace(/\s+/g, '');
    if (digits.length < 4 || !this.cardExpiry) {
      return;
    }
    const last4 = digits.slice(-4);
    const brand = digits.startsWith('4') ? 'Visa' : 'Mastercard';
    this.paymentService.addCard(brand, last4, this.cardExpiry);
    this.cancelAddCard();
  }
}
