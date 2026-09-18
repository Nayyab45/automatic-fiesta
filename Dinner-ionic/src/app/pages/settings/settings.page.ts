import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, UserAvatarComponent, HeaderComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage extends BasePage {
  readonly pageTitle = "Settings";
  private readonly profileService = inject(ProfileService);

  readonly isAdmin = signal(false);

  constructor() {
    super();
    this.profileService.me().subscribe({ next: ({ isAdmin }) => this.isAdmin.set(isAdmin), error: () => {} });
  }
}
