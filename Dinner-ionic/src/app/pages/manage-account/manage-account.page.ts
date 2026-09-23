import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
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
  imports: [CommonModule, RouterLink, ConfirmDialogComponent, FormsModule, HeaderComponent],
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
