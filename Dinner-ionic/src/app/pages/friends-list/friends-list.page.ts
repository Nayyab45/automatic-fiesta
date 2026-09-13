import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { Friend, FriendRequest, FriendsService } from '../../services/friends.service';
import { Match, ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-friends-list',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './friends-list.page.html',
  styleUrl: './friends-list.page.scss',
})
export class FriendsListPage extends BasePage {
  readonly pageTitle = 'Friends';
  private readonly friendsService = inject(FriendsService);
  private readonly profileService = inject(ProfileService);

  readonly activeTab = signal<'friends' | 'requests' | 'add'>('friends');

  readonly friends = signal<Friend[]>([]);
  readonly requests = signal<FriendRequest[]>([]);
  readonly loading = signal(true);

  // Reuses the same interests-based matching the app already computes for
  // "People You May Enjoy Dining With" -- "vibe and taste" here just means
  // that existing score/sharedInterests, not a second algorithm.
  private readonly allSuggestions = signal<Match[]>([]);
  readonly loadingSuggestions = signal(true);
  readonly sentRequestIds = signal<Set<number>>(new Set());
  readonly suggestions = computed(() => {
    const friendIds = new Set(this.friends().map((f) => f.id));
    return this.allSuggestions().filter((m) => !friendIds.has(m.id));
  });

  constructor() {
    super();
    this.reload();
    this.profileService.matches().subscribe({
      next: ({ matches }) => {
        this.allSuggestions.set(matches);
        this.loadingSuggestions.set(false);
      },
      error: () => this.loadingSuggestions.set(false),
    });
  }

  selectTab(tab: 'friends' | 'requests' | 'add'): void {
    this.activeTab.set(tab);
  }

  private reload(): void {
    this.loading.set(true);
    this.friendsService.requests().subscribe(({ requests }) => this.requests.set(requests));
    this.friendsService.list().subscribe({
      next: ({ friends }) => {
        this.friends.set(friends);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  accept(request: FriendRequest): void {
    this.friendsService.accept(request.id).subscribe(() => {
      this.requests.update((list) => list.filter((r) => r.id !== request.id));
      this.friends.update((list) => [{ id: request.requesterId, name: request.name, photoUrl: request.photoUrl, city: null }, ...list]);
    });
  }

  decline(request: FriendRequest): void {
    this.friendsService.decline(request.id).subscribe(() => {
      this.requests.update((list) => list.filter((r) => r.id !== request.id));
    });
  }

  unfriend(friend: Friend): void {
    this.friendsService.unfriend(friend.id).subscribe(() => {
      this.friends.update((list) => list.filter((f) => f.id !== friend.id));
    });
  }

  addFriend(match: Match): void {
    this.friendsService.send(match.id).subscribe(() => {
      this.sentRequestIds.update((ids) => new Set(ids).add(match.id));
    });
  }
}
