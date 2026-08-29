import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { AddPaymentMethodPayload, PaymentMethodType, PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-payment-methods',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './payment-methods.page.html',
  styleUrl: './payment-methods.page.scss',
})
export class PaymentMethodsPage extends BasePage {
  readonly pageTitle = 'Payment Methods';
  private readonly paymentService = inject(PaymentService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly paymentMethods = this.paymentService.paymentMethods;

  showAddForm = false;
  selectedType: PaymentMethodType = 'visa';

  cardNumber = '';
  cardExpiry = '';
  cardholderName = '';

  bankName = '';
  accountTitle = '';
  accountNumber = '';

  walletPhone = '';
  walletAccountTitle = '';

  constructor() {
    super();
    this.paymentService.load().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  openAddForm(type: PaymentMethodType): void {
    this.selectedType = type;
    this.showAddForm = true;
  }

  cancelAdd(): void {
    this.showAddForm = false;
    this.cardNumber = '';
    this.cardExpiry = '';
    this.cardholderName = '';
    this.bankName = '';
    this.accountTitle = '';
    this.accountNumber = '';
    this.walletPhone = '';
    this.walletAccountTitle = '';
  }

  save(): void {
    if (this.saving()) return;

    const payload = this.buildPayload();
    if (!payload) return;

    this.saving.set(true);
    this.paymentService.add(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelAdd();
      },
      error: () => this.saving.set(false),
    });
  }

  private buildPayload(): AddPaymentMethodPayload | null {
    if (this.selectedType === 'visa') {
      const digits = this.cardNumber.replace(/\s+/g, '');
      const [mm, yy] = this.cardExpiry.split('/');
      if (digits.length < 4 || !mm || !yy || !this.cardholderName.trim()) return null;
      return {
        type: 'visa',
        last4: digits.slice(-4),
        expiryMonth: Number(mm),
        expiryYear: Number(yy.trim().length === 2 ? `20${yy.trim()}` : yy.trim()),
        cardholderName: this.cardholderName.trim(),
      };
    }

    if (this.selectedType === 'bank') {
      const digits = this.accountNumber.replace(/\s+/g, '');
      if (!this.bankName.trim() || !this.accountTitle.trim() || digits.length < 4) return null;
      return {
        type: 'bank',
        bankName: this.bankName.trim(),
        accountTitle: this.accountTitle.trim(),
        last4: digits.slice(-4),
      };
    }

    const phone = this.walletPhone.replace(/[\s-]+/g, '');
    if (phone.length < 10) return null;
    return {
      type: this.selectedType,
      walletPhone: phone,
      accountTitle: this.walletAccountTitle.trim() || undefined,
    };
  }

  setDefault(id: number): void {
    this.paymentService.setDefault(id).subscribe();
  }

  remove(id: number): void {
    this.paymentService.remove(id).subscribe();
  }

  iconFor(type: PaymentMethodType): string {
    if (type === 'visa') return 'credit_card';
    if (type === 'bank') return 'account_balance';
    return 'account_balance_wallet';
  }

  labelFor(type: PaymentMethodType): string {
    if (type === 'visa') return 'Visa';
    if (type === 'bank') return 'Bank Account';
    if (type === 'easypaisa') return 'EasyPaisa';
    return 'JazzCash';
  }
}
