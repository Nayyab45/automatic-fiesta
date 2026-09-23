import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { PrivacySettings, ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HeaderComponent],
  templateUrl: './privacy-settings.page.html',
  styleUrl: './privacy-settings.page.scss',
})
export class PrivacySettingsPage extends BasePage {
  readonly pageTitle = "Privacy Settings";
  private readonly profileService = inject(ProfileService);

  readonly loading = signal(true);
  readonly saving = signal(false);

  settings: PrivacySettings = {
    profileVisible: true,
    showMutualInterests: true,
    showOnlineStatus: false,
    showProfileViews: true,
    locationPrecision: 'approximate',
  };

  constructor() {
    super();
    this.profileService.privacySettings().subscribe({
      next: ({ settings }) => {
        this.settings = settings;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    this.saving.set(true);
    this.profileService.updatePrivacySettings(this.settings).subscribe({
      next: () => {
        this.saving.set(false);
        this.goBack();
      },
      error: () => this.saving.set(false),
    });
  }
}
