import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-payment-methods',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './payment-methods.page.html',
  styleUrl: './payment-methods.page.scss',
})
export class PaymentMethodsPage extends BasePage {
  readonly pageTitle = 'Payment Methods';

  showAddCard = false;
  cardNumber = '';
  cardExpiry = '';
  readonly paymentService = inject(PaymentService);

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
