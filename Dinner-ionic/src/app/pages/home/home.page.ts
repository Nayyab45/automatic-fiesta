import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RootHeaderComponent } from '../../components/root-header/root-header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { WhatsNewComponent } from '../../components/whats-new/whats-new.component';
import { WhatsNewService } from '../../services/whats-new.service';
import { LocationService } from '../../services/location.service';
import { AuthService } from '../../services/auth.service';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';
import { Match, ProfileService } from '../../services/profile.service';
import { MessagingService } from '../../services/messaging.service';
import { FollowService } from '../../services/follow.service';

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, WhatsNewComponent, BottomNavComponent, UserAvatarComponent, RootHeaderComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage extends BasePage implements OnInit {
  readonly pageTitle = "Home";
  showWhatsNew = false;
  private readonly whatsNew = inject(WhatsNewService);
  readonly cityService = inject(LocationService);
  private readonly authService = inject(AuthService);
  private readonly tableService = inject(DiningTableService);
  private readonly profileService = inject(ProfileService);
  private readonly messagingService = inject(MessagingService);
  private readonly followService = inject(FollowService);

  readonly greeting = timeOfDayGreeting();
  readonly firstName = computed(() => this.authService.currentUser()?.name?.split(' ')[0] ?? 'there');

  readonly loadingTables = signal(true);
  readonly upcomingTable = signal<DiningTable | null>(null);

  readonly loadingMatches = signal(true);
  readonly matches = signal<Match[]>([]);
  readonly followBusyId = signal<number | null>(null);

  ngOnInit(): void {
    this.showWhatsNew = this.whatsNew.shouldShow();
    this.tableService.listMine().subscribe({
      next: ({ tables }) => {
        const upcoming = tables.filter((t) => !t.isPast).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
        this.upcomingTable.set(upcoming[0] ?? null);
        this.loadingTables.set(false);
      },
      error: () => this.loadingTables.set(false),
    });
    this.profileService.matches().subscribe({
      next: ({ matches }) => {
        this.matches.set(matches.slice(0, 6));
        this.loadingMatches.set(false);
      },
      error: () => this.loadingMatches.set(false),
    });
  }

  /** Mirrors discover-people's "message" action: there's no separate
   * connection/follow concept in the backend, just direct messaging, so
   * "Connect" here starts (or reopens) a DM with that match. */
  connect(match: Match): void {
    this.messagingService.getOrCreateWith(match.id).subscribe(({ conversation }) => this.go(`/dining-group-chat/dm/${conversation.id}`));
  }

  toggleFollow(match: Match): void {
    if (this.followBusyId() === match.id) return;
    this.followBusyId.set(match.id);
    const request$ = match.following ? this.followService.unfollow(match.id) : this.followService.follow(match.id);
    request$.subscribe({
      next: ({ following }) => {
        this.matches.update((list) => list.map((m) => (m.id === match.id ? { ...m, following } : m)));
        this.followBusyId.set(null);
      },
      error: () => this.followBusyId.set(null),
    });
  }
}
