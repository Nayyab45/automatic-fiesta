import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { PaymentMethod, PaymentService } from '../../services/payment.service';

const PLAN_PRICES = { monthly: 9.99, yearly: 95.9 } as const;

@Component({
  selector: 'app-subscribe-to-premium',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './subscribe-to-premium.page.html',
  styleUrl: './subscribe-to-premium.page.scss',
})
export class SubscribeToPremiumPage extends BasePage {
  readonly pageTitle = "Subscribe to Premium";
  private readonly paymentService = inject(PaymentService);

  selectedPlan: keyof typeof PLAN_PRICES = 'monthly';
  promoMessage = '';
  discount = 0;

  get subtotal(): number {
    return PLAN_PRICES[this.selectedPlan];
  }

  readonly loading = signal(true);
  readonly paymentMethods = this.paymentService.paymentMethods;
  selectedMethodId: number | null = null;
  readonly notConnected = signal(false);

  get total(): number {
    return Math.max(this.subtotal - this.discount, 0);
  }

  constructor() {
    super();
    this.paymentService.load().subscribe({
      next: ({ paymentMethods }) => {
        this.selectedMethodId = paymentMethods.find((m) => m.isDefault)?.id ?? paymentMethods[0]?.id ?? null;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  iconFor(type: PaymentMethod['type']): string {
    if (type === 'visa') return 'credit_card';
    if (type === 'bank') return 'account_balance';
    return 'account_balance_wallet';
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

  subscribe(): void {
    if (!this.selectedMethodId) return;
    // No payment gateway is connected yet (see payment-methods) -- this
    // stops short of pretending a charge succeeded and granting premium,
    // which would be fabricating a paid transaction that never happened.
    this.notConnected.set(true);
  }
}
