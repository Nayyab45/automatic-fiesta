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

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payment-methods`;

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
}
