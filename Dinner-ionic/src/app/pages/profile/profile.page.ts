import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RootHeaderComponent } from '../../components/root-header/root-header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';
import { PersonReview, Profile, ProfileService } from '../../services/profile.service';
import { MessagingService } from '../../services/messaging.service';
import { SafetyService } from '../../services/safety.service';
import { FriendsService, FriendStatus } from '../../services/friends.service';
import { FollowService } from '../../services/follow.service';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, RootHeaderComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage extends BasePage {
  readonly pageTitle = 'Profile';
  readonly cityService = inject(LocationService);
  private readonly profileService = inject(ProfileService);
  private readonly messagingService = inject(MessagingService);
  private readonly safetyService = inject(SafetyService);
  private readonly friendsService = inject(FriendsService);
  private readonly followService = inject(FollowService);
  private readonly tableService = inject(DiningTableService);

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly isOwnProfile = computed(() => !this.routeId());
  readonly isBlocked = signal(false);
  readonly friendStatus = signal<FriendStatus>('none');
  readonly friendRequestId = signal<number | null>(null);
  readonly friendsCount = signal(0);
  readonly pendingRequestsCount = signal(0);
  readonly isFollowing = signal(false);
  readonly followersCount = signal(0);
  readonly followingCount = signal(0);
  readonly profileViewsCount = signal(0);
  readonly publicEvents = signal<DiningTable[]>([]);
  readonly loadingPublicEvents = signal(false);
  readonly reviews = signal<PersonReview[]>([]);
  readonly loadingReviews = signal(false);
  // Reviews are shown nested under the specific past event they came from
  // (see profile.page.html's events section) rather than as their own flat
  // list, so they need to be grouped by tableId for quick per-card lookup.
  readonly reviewsByTableId = computed(() => {
    const map = new Map<number, PersonReview[]>();
    for (const review of this.reviews()) {
      const list = map.get(review.tableId) ?? [];
      list.push(review);
      map.set(review.tableId, list);
    }
    return map;
  });

  constructor() {
    super();
    const id = this.routeId();
    const request$ = id ? this.profileService.get(id) : this.profileService.me();
    request$.subscribe({
      next: ({ profile }) => {
        this.profile.set(profile);
        this.loading.set(false);
        // Backfills LocationService's home city for an account whose
        // profile city was set before "traveling" existed as a concept.
        // Own profile only (id is unset) -- never derive home-city state
        // from someone else's profile, and this never writes anything
        // visible on theirs either way.
        if (!id) this.cityService.syncHomeCityIfUnset(profile.city);

        this.loadingReviews.set(true);
        this.profileService.reviews(profile.id).subscribe({
          next: ({ reviews }) => {
            this.reviews.set(reviews);
            this.loadingReviews.set(false);
          },
          error: () => this.loadingReviews.set(false),
        });
      },
      error: () => this.loading.set(false),
    });

    if (id) {
      this.safetyService.blockedUsers().subscribe(({ blocked }) => {
        this.isBlocked.set(blocked.some((b) => b.userId === Number(id)));
      });
      this.friendsService.status(Number(id)).subscribe(({ status, requestId }) => {
        this.friendStatus.set(status);
        this.friendRequestId.set(requestId ?? null);
      });
      this.followService.status(Number(id)).subscribe(({ following }) => this.isFollowing.set(following));
      this.loadingPublicEvents.set(true);
      this.tableService.publicEventsFor(id).subscribe({
        next: ({ tables }) => {
          this.publicEvents.set(tables);
          this.loadingPublicEvents.set(false);
        },
        error: () => this.loadingPublicEvents.set(false),
      });
    } else {
      this.friendsService.list().subscribe(({ friends }) => this.friendsCount.set(friends.length));
      this.friendsService.requests().subscribe(({ requests }) => this.pendingRequestsCount.set(requests.length));
      this.followService.followers().subscribe(({ followers }) => this.followersCount.set(followers.length));
      this.followService.following().subscribe(({ following }) => this.followingCount.set(following.length));
      this.profileService.me().subscribe(({ profileViewsCount }) => this.profileViewsCount.set(profileViewsCount));
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
    request$.subscribe(() => {
      this.isBlocked.update((v) => !v);
      if (!this.isBlocked()) return;
      // Blocking ends any friendship server-side too -- mirror that here
      // instead of waiting on a refetch.
      this.friendStatus.set('none');
      this.friendRequestId.set(null);
    });
  }

  sendFriendRequest(): void {
    const profile = this.profile();
    if (!profile) return;
    this.friendsService.send(profile.id).subscribe(({ status, requestId }) => {
      this.friendStatus.set(status);
      this.friendRequestId.set(requestId);
    });
  }

  // Doubles as "cancel" when a request I sent is still pending -- the
  // backend's decline endpoint accepts either side of the pair.
  cancelOrDeclineFriendRequest(): void {
    const requestId = this.friendRequestId();
    if (!requestId) return;
    this.friendsService.decline(requestId).subscribe(() => {
      this.friendStatus.set('none');
      this.friendRequestId.set(null);
    });
  }

  acceptFriendRequest(): void {
    const requestId = this.friendRequestId();
    if (!requestId) return;
    this.friendsService.accept(requestId).subscribe(({ status }) => this.friendStatus.set(status));
  }

  unfriend(): void {
    const profile = this.profile();
    if (!profile) return;
    this.friendsService.unfriend(profile.id).subscribe(() => {
      this.friendStatus.set('none');
      this.friendRequestId.set(null);
    });
  }

  toggleFollow(): void {
    const profile = this.profile();
    if (!profile) return;
    const request$ = this.isFollowing() ? this.followService.unfollow(profile.id) : this.followService.follow(profile.id);
    request$.subscribe(({ following }) => this.isFollowing.set(following));
  }

  reviewsForTable(tableId: number): PersonReview[] {
    return this.reviewsByTableId().get(tableId) ?? [];
  }
}
