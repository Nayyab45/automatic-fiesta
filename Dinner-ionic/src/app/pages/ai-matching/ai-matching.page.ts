import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { LocationService } from '../../services/location.service';
import { Match, ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-ai-matching',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, UserAvatarComponent],
  templateUrl: './ai-matching.page.html',
  styleUrl: './ai-matching.page.scss',
})
export class AiMatchingPage extends BasePage {
  readonly pageTitle = 'AI Matching';
  readonly cityService = inject(LocationService);
  private readonly profileService = inject(ProfileService);

  readonly match = signal<Match | null>(null);
  readonly loading = signal(true);

  constructor() {
    super();
    this.profileService.matches().subscribe({
      next: ({ matches }) => {
        this.match.set(matches[0] ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
