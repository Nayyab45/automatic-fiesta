import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Share } from '@capacitor/share';
import { BasePage } from '../base.page';
import { AuthService } from '../../services/auth.service';
import { googleMapsUrl, staticMapUrl, RestaurantDetail, RestaurantReview, RestaurantService } from '../../services/restaurant.service';
import { Friend, FriendsService } from '../../services/friends.service';
import { MessagingService } from '../../services/messaging.service';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-detail.page.html',
  styleUrl: './restaurant-detail.page.scss',
})
export class RestaurantDetailPage extends BasePage {
  readonly pageTitle = 'Restaurant Detail';
  private readonly restaurantService = inject(RestaurantService);
  private readonly authService = inject(AuthService);
  private readonly friendsService = inject(FriendsService);
  private readonly messagingService = inject(MessagingService);

  readonly restaurant = signal<RestaurantDetail | null>(null);
  readonly loading = signal(true);
  saved = false;

  // In-app "send to a friend" -- separate from share() above, which only
  // ever hands off to the OS share sheet (no record of who it reached, and
  // nothing for someone without the app installed to open). This sends a
  // real DM through the same conversations a friend already has.
  readonly showFriendPicker = signal(false);
  readonly friends = signal<Friend[]>([]);
  readonly loadingFriends = signal(false);
  readonly sendingToFriendId = signal<number | null>(null);
  readonly sentToFriendIds = signal<Set<number>>(new Set());

  readonly stars = [1, 2, 3, 4, 5];
  readonly reviews = signal<RestaurantReview[]>([]);
  readonly myReview = computed(() => {
    const userId = this.authService.currentUser()?.id;
    return this.reviews().find((r) => r.reviewerUserId === userId) ?? null;
  });
  readonly editingReview = signal(false);
  readonly draftRating = signal(0);
  readonly submittingReview = signal(false);
  draftComment = '';

  readonly cuisineTags = computed(() => this.restaurant()?.cuisineTags.split(',') ?? []);

  constructor() {
    super();
    effect(
      () => {
        const id = this.routeId();
        if (!id) {
          this.loading.set(false);
          return;
        }
        this.loading.set(true);
        this.restaurantService.get(id).subscribe({
          next: ({ restaurant }) => {
            this.restaurant.set(restaurant);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
        this.restaurantService.reviews(id).subscribe({
          next: ({ reviews }) => this.reviews.set(reviews),
        });
      },
      { allowSignalWrites: true },
    );
  }

  startReview(): void {
    const existing = this.myReview();
    this.draftRating.set(existing?.rating ?? 0);
    this.draftComment = existing?.comment ?? '';
    this.editingReview.set(true);
  }

  cancelReview(): void {
    this.editingReview.set(false);
  }

  setDraftRating(value: number): void {
    this.draftRating.set(value);
  }

  submitReview(): void {
    const restaurant = this.restaurant();
    if (!restaurant || this.draftRating() === 0) return;
    this.submittingReview.set(true);
    this.restaurantService
      .submitReview(restaurant.id, { rating: this.draftRating(), comment: this.draftComment.trim() || undefined })
      .subscribe({
        next: ({ review }) => {
          this.reviews.set([review, ...this.reviews().filter((r) => r.id !== review.id)]);
          this.editingReview.set(false);
          this.submittingReview.set(false);
          this.refreshRating();
        },
        error: () => this.submittingReview.set(false),
      });
  }

  deleteReview(): void {
    const restaurant = this.restaurant();
    if (!restaurant) return;
    this.restaurantService.deleteReview(restaurant.id).subscribe(() => {
      const userId = this.authService.currentUser()?.id;
      this.reviews.set(this.reviews().filter((r) => r.reviewerUserId !== userId));
      this.refreshRating();
    });
  }

  // The average/count shown come from the backend's recomputed aggregate
  // (restaurants.js), not something derived client-side from `reviews` --
  // simplest way to stay in sync with it after a write is to just refetch.
  private refreshRating(): void {
    const restaurant = this.restaurant();
    if (!restaurant) return;
    this.restaurantService.get(restaurant.id).subscribe({
      next: ({ restaurant }) => this.restaurant.set(restaurant),
    });
  }

  toggleSave(): void {
    const restaurant = this.restaurant();
    if (!restaurant) return;
    const request$ = this.saved ? this.restaurantService.unsave(restaurant.id) : this.restaurantService.save(restaurant.id);
    request$.subscribe(({ saved }) => (this.saved = saved));
  }

  mapsUrl(restaurant: RestaurantDetail): string {
    return googleMapsUrl(restaurant);
  }

  mapImageUrl(restaurant: RestaurantDetail): string | null {
    if (restaurant.latitude == null || restaurant.longitude == null) return null;
    return staticMapUrl(restaurant.latitude, restaurant.longitude);
  }

  async share(): Promise<void> {
    const restaurant = this.restaurant();
    if (!restaurant) return;
    const shareData = { title: restaurant.name, text: `Check out ${restaurant.name}`, url: window.location.href };
    try {
      await Share.share(shareData);
    } catch {
      navigator.clipboard?.writeText(shareData.url).catch(() => {});
    }
  }

  openFriendPicker(): void {
    this.showFriendPicker.set(true);
    this.sentToFriendIds.set(new Set());
    if (this.friends().length > 0) return;
    this.loadingFriends.set(true);
    this.friendsService.list().subscribe({
      next: ({ friends }) => {
        this.friends.set(friends);
        this.loadingFriends.set(false);
      },
      error: () => this.loadingFriends.set(false),
    });
  }

  closeFriendPicker(): void {
    this.showFriendPicker.set(false);
  }

  sendToFriend(friend: Friend): void {
    const restaurant = this.restaurant();
    if (!restaurant || this.sendingToFriendId() !== null) return;
    this.sendingToFriendId.set(friend.id);
    const body = `Check out ${restaurant.name}${restaurant.city ? ` in ${restaurant.city}` : ''}${restaurant.rating !== null ? ` (${restaurant.rating}★)` : ''} -- thought you'd like it.`;
    this.messagingService.getOrCreateWith(friend.id).subscribe({
      next: ({ conversation }) => {
        this.messagingService.sendMessage(conversation.id, body).subscribe({
          next: () => {
            this.sendingToFriendId.set(null);
            this.sentToFriendIds.update((ids) => new Set(ids).add(friend.id));
          },
          error: () => this.sendingToFriendId.set(null),
        });
      },
      error: () => this.sendingToFriendId.set(null),
    });
  }
}
