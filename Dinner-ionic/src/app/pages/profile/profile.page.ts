import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';
import { Profile, ProfileService } from '../../services/profile.service';
import { MessagingService } from '../../services/messaging.service';
import { SafetyService } from '../../services/safety.service';

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
  private readonly messagingService = inject(MessagingService);
  private readonly safetyService = inject(SafetyService);

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly isOwnProfile = computed(() => !this.routeId());
  readonly isBlocked = signal(false);

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

    if (id) {
      this.safetyService.blockedUsers().subscribe(({ blocked }) => {
        this.isBlocked.set(blocked.some((b) => b.userId === Number(id)));
      });
    }
  }

  message(): void {
    const profile = this.profile();
    if (!profile) return;
    this.messagingService.getOrCreateWith(profile.id).subscribe(({ conversation }) => this.go(`/dining-group-chat/dm/${conversation.id}`));
  }

  toggleBlock(): void {
    const profile = this.profile();
    if (!profile) return;
    const request$ = this.isBlocked() ? this.safetyService.unblock(profile.id) : this.safetyService.block(profile.id);
    request$.subscribe(() => this.isBlocked.update((v) => !v));
  }
}
