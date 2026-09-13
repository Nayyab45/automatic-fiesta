import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BasePage } from '../base.page';
import { PaymentMethod, PaymentService } from '../../services/payment.service';

const PLAN_PRICES = { monthly: 9.99, yearly: 95.9 } as const;

@Component({
  selector: 'app-subscribe-to-premium',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HeaderComponent],
  templateUrl: './subscribe-to-premium.page.html',
  styleUrl: './subscribe-to-premium.page.scss',
})
export class SubscribeToPremiumPage extends BasePage {
  readonly pageTitle = "Subscribe to Premium";
  private readonly paymentService = inject(PaymentService);

  selectedPlan: keyof typeof PLAN_PRICES = 'monthly';
  promoMessage = '';
  discount = 0;
  cnicLast6 = '';

  get subtotal(): number {
    return PLAN_PRICES[this.selectedPlan];
  }

  readonly loading = signal(true);
  readonly paymentMethods = this.paymentService.paymentMethods;
  selectedMethodId: number | null = null;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  get total(): number {
    return Math.max(this.subtotal - this.discount, 0);
  }

  get selectedMethod(): PaymentMethod | null {
    return this.paymentMethods().find((m) => m.id === this.selectedMethodId) ?? null;
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
    const method = this.selectedMethod;
    if (!method || this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.paymentService.checkout(method.id, this.selectedPlan, this.cnicLast6 || undefined).subscribe({
      next: (result) => {
        if (result.status === 'succeeded') {
          this.go('/subscribe-to-premium-success');
        } else if (result.status === 'redirect') {
          // Hosted-checkout gateway (bank/visa): the customer finishes
          // payment on the gateway's own page, not in this app.
          window.location.href = result.redirectUrl;
        } else {
          this.submitting.set(false);
          this.errorMessage.set(result.message);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        // 503 here specifically means "this provider's gateway credentials
        // aren't set on the backend yet" -- see subscriptions.js.
        this.errorMessage.set(err.error?.message ?? 'Something went wrong. Please try again.');
      },
    });
  }
}
