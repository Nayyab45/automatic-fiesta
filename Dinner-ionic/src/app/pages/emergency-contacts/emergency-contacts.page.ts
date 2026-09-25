import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { EmergencyContact, SafetyService } from '../../services/safety.service';

@Component({
  selector: 'app-emergency-contacts',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HeaderComponent, ConfirmDialogComponent],
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

  // Selection-to-delete, same pattern as messages.page.ts -- a per-row
  // delete icon was too easy to tap by accident on a screen that exists
  // specifically to hold phone numbers you rely on in an emergency; the
  // row itself now dials instead (see call()).
  readonly selecting = signal(false);
  readonly selectedIds = signal<Set<number>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly showDeleteConfirm = signal(false);
  readonly deleting = signal(false);

  name = '';
  relationship = '';
  phone = '';
  email = '';
  notifyOnCheckin = true;
  notifyOnNoCheckout = true;
  notifyOnCheckout = true;

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
        notifyOnCheckout: this.notifyOnCheckout,
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

  /** Same tel: approach as safety-checkin.page.ts's emergency-services call
   * -- the OS dialer handles it on both Android and a plain browser tab. */
  call(contact: EmergencyContact): void {
    window.location.href = `tel:${contact.phone}`;
  }

  toggleSelecting(): void {
    if (this.selecting()) {
      this.exitSelection();
    } else {
      this.selecting.set(true);
    }
  }

  private exitSelection(): void {
    this.selecting.set(false);
    this.selectedIds.set(new Set());
  }

  toggleSelected(id: number): void {
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  deleteSelected(): void {
    if (this.deleting() || this.selectedCount() === 0) return;
    this.deleting.set(true);

    const ids = [...this.selectedIds()];
    // Best-effort per contact, same reasoning as messages.page.ts's
    // deleteSelected -- one already-gone contact shouldn't stop the rest.
    let remaining = ids.length;
    const settle = () => {
      remaining -= 1;
      if (remaining > 0) return;
      this.contacts.update((list) => list.filter((c) => !ids.includes(c.id)));
      this.deleting.set(false);
      this.showDeleteConfirm.set(false);
      this.exitSelection();
    };
    ids.forEach((id) => this.safetyService.removeEmergencyContact(id).subscribe({ next: settle, error: settle }));
  }
}
