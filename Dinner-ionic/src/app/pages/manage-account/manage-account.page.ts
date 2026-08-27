import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-manage-account',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmDialogComponent],
  templateUrl: './manage-account.page.html',
  styleUrl: './manage-account.page.scss',
})
export class ManageAccountPage extends BasePage {
  readonly pageTitle = "Manage Account";
  showDeleteConfirm = false;

  fullName = 'Ayesha Khan';
  email = 'ayesha.khan@example.com';
  phone = '+92 300 1234567';
  twoFactorEnabled = true;
  avatarUrl = '';

  confirmDeleteAccount(): void {
    this.showDeleteConfirm = false;
    this.go('/login');
  }

  editFullName(): void {
    const value = window.prompt('Full Name', this.fullName);
    if (value) this.fullName = value;
  }

  editEmail(): void {
    const value = window.prompt('Email Address', this.email);
    if (value) this.email = value;
  }

  editPhone(): void {
    const value = window.prompt('Phone Number', this.phone);
    if (value) this.phone = value;
  }

  toggleTwoFactor(): void {
    this.twoFactorEnabled = !this.twoFactorEnabled;
  }

  onAvatarSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => (this.avatarUrl = reader.result as string);
    reader.readAsDataURL(file);
  }
}
