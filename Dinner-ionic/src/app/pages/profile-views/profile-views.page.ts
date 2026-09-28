import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { ProfileService, Viewer } from '../../services/profile.service';

@Component({
  selector: 'app-profile-views',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './profile-views.page.html',
  styleUrl: './profile-views.page.scss',
})
export class ProfileViewsPage extends BasePage {
  readonly pageTitle = 'Profile Views';
  private readonly profileService = inject(ProfileService);

  readonly viewers = signal<Viewer[]>([]);
  readonly loading = signal(true);
  /** True when the backend 402s -- this account is on a tier below Standard
   * (see /api/profile/me/viewers in Backend/src/routes/profile.js). */
  readonly locked = signal(false);

  constructor() {
    super();
    this.profileService.viewers().subscribe({
      next: ({ viewers }) => {
        this.viewers.set(viewers);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.locked.set(err.status === 402);
        this.loading.set(false);
      },
    });
  }
}
