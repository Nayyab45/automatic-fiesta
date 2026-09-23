import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, UserAvatarComponent, HeaderComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage extends BasePage {
  readonly pageTitle = "Settings";
  private readonly authService = inject(AuthService);

  // Actually ends the session (clears the stored tokens and revokes the
  // refresh token) -- this button used to just open the login screen and
  // leave the user signed in. Same call Manage Account's Log Out makes.
  logout(): void {
    this.authService.logout();
    this.go('/login');
  }
}
