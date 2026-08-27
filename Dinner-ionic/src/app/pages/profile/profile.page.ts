import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';
import { Profile, ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage extends BasePage {
  readonly pageTitle = 'Profile';
  readonly cityService = inject(LocationService);
  private readonly profileService = inject(ProfileService);

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly isOwnProfile = computed(() => !this.routeId());

  constructor() {
    super();
    const id = this.routeId();
    const request$ = id ? this.profileService.get(id) : this.profileService.me();
    request$.subscribe({
      next: ({ profile }) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
