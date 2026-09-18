import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
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
  /** True only on the 402 a free account gets back -- distinct from a real
   * network/server error, which stays as a generic empty state instead. */
  readonly needsPremium = signal(false);

  constructor() {
    super();
    this.profileService.viewers().subscribe({
      next: ({ viewers }) => {
        this.viewers.set(viewers);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.needsPremium.set(err.status === 402);
        this.loading.set(false);
      },
    });
  }
}
