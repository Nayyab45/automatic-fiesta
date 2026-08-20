import { Injectable, signal } from '@angular/core';

export interface PaymentMethod {
  id: string;
  brand: 'Visa' | 'Mastercard';
  last4: string;
  expiry: string;
  isDefault: boolean;
}

const STORAGE_KEY = 'paymentMethods';

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: 'pm_1', brand: 'Visa', last4: '4242', expiry: '08/27', isDefault: true },
];

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly methods = signal<PaymentMethod[]>(this.loadInitial());
  readonly paymentMethods = this.methods.asReadonly();

  private loadInitial(): PaymentMethod[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_METHODS;
    } catch {
      return DEFAULT_METHODS;
    }
  }

  private persist(methods: PaymentMethod[]): void {
    this.methods.set(methods);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(methods));
    } catch {
      /* localStorage unavailable, nothing to persist */
    }
  }

  addCard(brand: 'Visa' | 'Mastercard', last4: string, expiry: string): void {
    const isFirst = this.methods().length === 0;
    const newMethod: PaymentMethod = { id: `pm_${Date.now()}`, brand, last4, expiry, isDefault: isFirst };
    this.persist([...this.methods(), newMethod]);
  }

  removeCard(id: string): void {
    const remaining = this.methods().filter((m) => m.id !== id);
    if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
      remaining[0].isDefault = true;
    }
    this.persist(remaining);
  }

  setDefault(id: string): void {
    this.persist(this.methods().map((m) => ({ ...m, isDefault: m.id === id })));
  }
}
