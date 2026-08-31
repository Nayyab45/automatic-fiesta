import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export type PaymentMethodType = 'visa' | 'bank' | 'easypaisa' | 'jazzcash';

export interface PaymentMethod {
  id: number;
  type: PaymentMethodType;
  label: string;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  cardholderName: string | null;
  bankName: string | null;
  accountTitle: string | null;
  walletPhone: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface AddVisaPayload {
  type: 'visa';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cardholderName: string;
}

export interface AddBankPayload {
  type: 'bank';
  bankName: string;
  accountTitle: string;
  last4: string;
}

export interface AddWalletPayload {
  type: 'easypaisa' | 'jazzcash';
  walletPhone: string;
  accountTitle?: string;
}

export type AddPaymentMethodPayload = AddVisaPayload | AddBankPayload | AddWalletPayload;

export type Plan = 'monthly' | 'yearly';

export interface Subscription {
  status: 'inactive' | 'active' | 'canceled' | 'past_due';
  plan: Plan | null;
  provider: PaymentMethodType | null;
  currentPeriodEnd: string | null;
}

/** Mirrors the three shapes POST /subscriptions/checkout can return -- see
 * subscriptions.js: a wallet gateway (JazzCash/EasyPaisa) charges
 * synchronously and answers with 'succeeded'/'failed' directly; a
 * hosted-checkout gateway (bank/visa) can't know the outcome yet and
 * answers 'redirect' with a URL to send the customer to instead. */
export type CheckoutResult =
  | { status: 'succeeded'; subscription: Subscription }
  | { status: 'failed'; message: string }
  | { status: 'redirect'; redirectUrl: string };

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payment-methods`;
  private readonly subscriptionsUrl = `${environment.apiUrl}/subscriptions`;

  private readonly methods = signal<PaymentMethod[]>([]);
  readonly paymentMethods = this.methods.asReadonly();

  load(): Observable<{ paymentMethods: PaymentMethod[] }> {
    return this.http
      .get<{ paymentMethods: PaymentMethod[] }>(this.baseUrl)
      .pipe(tap(({ paymentMethods }) => this.methods.set(paymentMethods)));
  }

  add(payload: AddPaymentMethodPayload): Observable<{ paymentMethod: PaymentMethod }> {
    return this.http
      .post<{ paymentMethod: PaymentMethod }>(this.baseUrl, payload)
      .pipe(tap(({ paymentMethod }) => this.methods.update((list) => [...list, paymentMethod])));
  }

  setDefault(id: number): Observable<{ paymentMethods: PaymentMethod[] }> {
    return this.http
      .put<{ paymentMethods: PaymentMethod[] }>(`${this.baseUrl}/${id}/default`, {})
      .pipe(tap(({ paymentMethods }) => this.methods.set(paymentMethods)));
  }

  remove(id: number): Observable<{ paymentMethods: PaymentMethod[] }> {
    return this.http
      .delete<{ paymentMethods: PaymentMethod[] }>(`${this.baseUrl}/${id}`)
      .pipe(tap(({ paymentMethods }) => this.methods.set(paymentMethods)));
  }

  getSubscription(): Observable<{ subscription: Subscription }> {
    return this.http.get<{ subscription: Subscription }>(`${this.subscriptionsUrl}/me`);
  }

  /** cnicLast6 is only meaningful (and only required server-side) when the
   * chosen payment method is a JazzCash wallet -- see subscriptions.js. */
  checkout(paymentMethodId: number, plan: Plan, cnicLast6?: string): Observable<CheckoutResult> {
    return this.http.post<CheckoutResult>(`${this.subscriptionsUrl}/checkout`, { paymentMethodId, plan, cnicLast6 });
  }
}
