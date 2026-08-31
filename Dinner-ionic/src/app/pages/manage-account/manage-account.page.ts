import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { resizeImageToDataUrl } from '../../shared/image-resize';

@Component({
  selector: 'app-manage-account',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmDialogComponent, FormsModule],
  templateUrl: './manage-account.page.html',
  styleUrl: './manage-account.page.scss',
})
export class ManageAccountPage extends BasePage {
  readonly pageTitle = "Manage Account";
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  readonly loading = signal(true);
  readonly deleting = signal(false);
  showDeleteConfirm = false;

  fullName = '';
  email = '';
  phone = '';
  avatarUrl = '';

  readonly twoFactorEnabled = signal(false);
  readonly twoFactorSetup = signal<{ secret: string; qrCodeDataUrl: string } | null>(null);
  readonly twoFactorBusy = signal(false);
  readonly twoFactorError = signal<string | null>(null);
  twoFactorCode = '';

  constructor() {
    super();
    const user = this.authService.currentUser();
    this.fullName = user?.name ?? '';
    this.email = user?.email ?? '';

    this.profileService.me().subscribe({
      next: ({ profile }) => {
        this.phone = profile.phone ?? '';
        this.avatarUrl = profile.photoUrl ?? '';
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.authService.get2faStatus().subscribe(({ enabled }) => this.twoFactorEnabled.set(enabled));
  }

  startTwoFactorSetup(): void {
    this.twoFactorBusy.set(true);
    this.twoFactorError.set(null);
    this.authService.setup2fa().subscribe({
      next: (setup) => {
        this.twoFactorSetup.set(setup);
        this.twoFactorBusy.set(false);
      },
      error: () => {
        this.twoFactorError.set('Could not start setup. Please try again.');
        this.twoFactorBusy.set(false);
      },
    });
  }

  cancelTwoFactorSetup(): void {
    this.twoFactorSetup.set(null);
    this.twoFactorCode = '';
    this.twoFactorError.set(null);
  }

  confirmTwoFactorSetup(): void {
    if (!this.twoFactorCode) return;
    this.twoFactorBusy.set(true);
    this.twoFactorError.set(null);
    this.authService.enable2fa(this.twoFactorCode).subscribe({
      next: () => {
        this.twoFactorEnabled.set(true);
        this.twoFactorSetup.set(null);
        this.twoFactorCode = '';
        this.twoFactorBusy.set(false);
      },
      error: (err) => {
        this.twoFactorError.set(err?.error?.message ?? 'Incorrect code. Please try again.');
        this.twoFactorBusy.set(false);
      },
    });
  }

  disableTwoFactor(): void {
    const code = window.prompt('Enter the current 6-digit code from your authenticator app to turn off Two-Factor Authentication:');
    if (!code) return;
    this.twoFactorBusy.set(true);
    this.authService.disable2fa(code).subscribe({
      next: () => {
        this.twoFactorEnabled.set(false);
        this.twoFactorBusy.set(false);
      },
      error: (err) => {
        window.alert(err?.error?.message ?? 'Incorrect code.');
        this.twoFactorBusy.set(false);
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.go('/login');
  }

  confirmDeleteAccount(): void {
    this.showDeleteConfirm = false;
    this.deleting.set(true);
    this.authService.deleteMe().subscribe({
      next: () => this.go('/login'),
      error: () => this.deleting.set(false),
    });
  }

  editFullName(): void {
    const value = window.prompt('Full Name', this.fullName);
    if (!value || value === this.fullName) return;
    this.authService.updateMe({ name: value }).subscribe(({ user }) => (this.fullName = user.name));
  }

  editEmail(): void {
    const value = window.prompt('Email Address', this.email);
    if (!value || value === this.email) return;
    this.authService.updateMe({ email: value }).subscribe({
      next: ({ user }) => (this.email = user.email),
      error: (err) => window.alert(err?.error?.message ?? 'Could not update email'),
    });
  }

  editPhone(): void {
    const value = window.prompt('Phone Number', this.phone);
    if (value === null || value === this.phone) return;
    this.profileService.updateMe({ phone: value }).subscribe(({ profile }) => (this.phone = profile.phone ?? ''));
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    resizeImageToDataUrl(file)
      .then((dataUrl) => {
        this.profileService.updateMe({ photoUrl: dataUrl }).subscribe({
          next: ({ profile }) => (this.avatarUrl = profile.photoUrl ?? dataUrl),
          error: (err) => window.alert(err?.error?.message ?? 'Could not upload photo. Please try again.'),
        });
      })
      .catch((err) => window.alert(err?.message ?? 'Could not process the selected image.'))
      .finally(() => (input.value = ''));
  }
}
