import { Component, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { FollowService, FollowedUser } from '../../services/follow.service';

type Tab = 'followers' | 'following';

@Component({
  selector: 'app-followers',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './followers.page.html',
  styleUrl: './followers.page.scss',
})
export class FollowersPage extends BasePage {
  readonly pageTitle = 'Followers';
  private readonly followService = inject(FollowService);

  readonly activeTab = signal<Tab>(this.route.snapshot.queryParamMap.get('tab') === 'following' ? 'following' : 'followers');
  readonly followers = signal<FollowedUser[]>([]);
  readonly following = signal<FollowedUser[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  /** The user a request is in flight for -- disables that row's buttons only. */
  readonly busyId = signal<number | null>(null);
  readonly error = signal<string | null>(null);

  private readonly followingIds = computed(() => new Set(this.following().map((u) => u.id)));

  constructor() {
    super();
    let pending = 2;
    const done = () => {
      if (--pending === 0) this.loading.set(false);
    };
    const fail = () => {
      this.failed.set(true);
      done();
    };
    this.followService.followers().subscribe({
      next: ({ followers }) => {
        this.followers.set(followers);
        done();
      },
      error: fail,
    });
    this.followService.following().subscribe({
      next: ({ following }) => {
        this.following.set(following);
        done();
      },
      error: fail,
    });
  }

  selectTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.error.set(null);
  }

  followsBack(user: FollowedUser): boolean {
    return this.followingIds().has(user.id);
  }

  removeFollower(user: FollowedUser): void {
    if (this.busyId() !== null) return;
    if (!confirm(`Remove ${user.name} from your followers? They can follow you again.`)) return;
    this.run(user, this.followService.removeFollower(user.id), () =>
      this.followers.update((list) => list.filter((u) => u.id !== user.id)),
    );
  }

  followBack(user: FollowedUser): void {
    if (this.busyId() !== null) return;
    this.run(user, this.followService.follow(user.id), () => this.following.update((list) => [user, ...list]));
  }

  unfollow(user: FollowedUser): void {
    if (this.busyId() !== null) return;
    this.run(user, this.followService.unfollow(user.id), () =>
      this.following.update((list) => list.filter((u) => u.id !== user.id)),
    );
  }

  private run(user: FollowedUser, request: Observable<unknown>, onDone: () => void): void {
    this.busyId.set(user.id);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        onDone();
      },
      error: () => {
        this.busyId.set(null);
        this.error.set("That didn't work. Check your connection and try again.");
      },
    });
  }
}
