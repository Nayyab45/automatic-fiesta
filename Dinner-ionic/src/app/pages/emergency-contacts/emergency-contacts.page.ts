import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { EmergencyContact, SafetyService } from '../../services/safety.service';

@Component({
  selector: 'app-emergency-contacts',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './emergency-contacts.page.html',
  styleUrl: './emergency-contacts.page.scss',
})
export class EmergencyContactsPage extends BasePage {
  readonly pageTitle = "Emergency Contacts";
  private readonly safetyService = inject(SafetyService);

  readonly contacts = signal<EmergencyContact[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(true);

  name = '';
  relationship = '';
  phone = '';
  email = '';
  notifyOnCheckin = true;
  notifyOnNoCheckout = true;

  constructor() {
    super();
    this.load();
  }

  private load(): void {
    this.safetyService.emergencyContacts().subscribe({
      next: ({ contacts }) => {
        this.contacts.set(contacts);
        this.loading.set(false);
        this.showForm.set(contacts.length === 0);
      },
      error: () => this.loading.set(false),
    });
  }

  addAnother(): void {
    this.showForm.set(true);
  }

  save(): void {
    if (!this.name.trim() || !this.phone.trim() || this.saving()) return;

    this.saving.set(true);
    this.safetyService
      .addEmergencyContact({
        name: this.name.trim(),
        relationship: this.relationship || undefined,
        phone: this.phone.trim(),
        email: this.email.trim() || undefined,
        notifyOnCheckin: this.notifyOnCheckin,
        notifyOnNoCheckout: this.notifyOnNoCheckout,
      })
      .subscribe({
        next: ({ contact }) => {
          this.contacts.update((list) => [...list, contact]);
          this.saving.set(false);
          this.showForm.set(false);
          this.name = '';
          this.relationship = '';
          this.phone = '';
          this.email = '';
        },
        error: () => this.saving.set(false),
      });
  }

  remove(contact: EmergencyContact): void {
    this.safetyService.removeEmergencyContact(contact.id).subscribe(() => {
      this.contacts.update((list) => list.filter((c) => c.id !== contact.id));
    });
  }
}
