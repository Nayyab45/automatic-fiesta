import { Component, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { Restaurant, RestaurantService } from '../../services/restaurant.service';
import { DiningTableService, TableAudience } from '../../services/dining-table.service';
import { Friend, FriendsService } from '../../services/friends.service';
import { LocationService } from '../../services/location.service';
import { Match, ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-create-table',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HeaderComponent],
  templateUrl: './create-table.page.html',
  styleUrl: './create-table.page.scss',
})
export class CreateTablePage extends BasePage {
  readonly pageTitle = 'Send Request';
  private readonly restaurantService = inject(RestaurantService);
  private readonly tableService = inject(DiningTableService);
  private readonly friendsService = inject(FriendsService);
  private readonly locationService = inject(LocationService);
  private readonly profileService = inject(ProfileService);

  readonly gatheringTypes = ['Dinner', 'Lunch', 'Brunch', 'Chai Meetup'];
  readonly atmospheres = ['Casual Dinner', 'Social Conversation', 'Business Networking'];
  readonly audienceOptions: { value: TableAudience; label: string }[] = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'women_only', label: 'Women only' },
    { value: 'friends_only', label: 'Friends only' },
  ];
  readonly restaurants = signal<Restaurant[]>([]);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // "AI suggests restaurants everyone in the group will enjoy" -- lets the
  // host pick which friends they're planning to invite before picking a
  // restaurant, then asks the backend (POST /restaurants/group-recommendation)
  // to pick one everyone's food/dietary preferences actually support, rather
  // than the host guessing alone. Entirely optional: ignoring this section
  // and picking from the dropdown above still works exactly as before.
  readonly friends = signal<Friend[]>([]);
  readonly selectedFriendIds = signal<number[]>([]);
  readonly aiSuggesting = signal(false);
  readonly aiSuggestion = signal<{ restaurantName: string; reason: string; aiPowered: boolean } | null>(null);
  readonly aiError = signal<string | null>(null);

  // Who to send a table invite to once this table is created -- friends()
  // above doubles as the "Friends" group; suggestions is everyone matches()
  // returns who isn't already a friend, i.e. the "Suggestions" group.
  readonly suggestions = signal<Match[]>([]);
  readonly selectedInviteeIds = signal<number[]>([]);

  // Dropdown-filter state for the "Invite People" picker below -- the
  // Friends/Suggestions lists themselves and selectedInviteeIds are
  // unchanged, only how they're browsed/selected.
  readonly inviteDropdownOpen = signal(false);
  readonly inviteFilter = signal('');
  @ViewChild('inviteDropdownContainer') private inviteDropdownContainer?: ElementRef<HTMLElement>;
  readonly filteredFriends = computed(() => {
    const q = this.inviteFilter().trim().toLowerCase();
    return q ? this.friends().filter((f) => f.name.toLowerCase().includes(q)) : this.friends();
  });
  readonly filteredSuggestions = computed(() => {
    const q = this.inviteFilter().trim().toLowerCase();
    return q ? this.suggestions().filter((s) => s.name.toLowerCase().includes(q)) : this.suggestions();
  });
  readonly selectedInviteeNames = computed(() => {
    const ids = new Set(this.selectedInviteeIds());
    return [...this.friends(), ...this.suggestions()].filter((p) => ids.has(p.id)).map((p) => p.name);
  });

  gatheringType = 'Dinner';
  atmosphere = 'Social Conversation';
  restaurantId: number | null = null;
  date = '';
  time = '';
  seatsTotal = 4;
  visibility = true;
  // Only meaningful while visibility is public -- a private table is already
  // invite-only regardless of audience (see Backend/src/routes/tables.js).
  audience: TableAudience = 'everyone';
  note = '';

  constructor() {
    super();
    const restaurantIdParam = this.route.snapshot.queryParamMap.get('restaurantId');
    this.restaurantId = restaurantIdParam ? Number(restaurantIdParam) : null;
    // Only the city being browsed (same one Discover uses) -- except when
    // arriving from one specific restaurant's page, whose own city wins so
    // that restaurant is always in the list.
    if (this.restaurantId) {
      this.restaurantService.get(this.restaurantId).subscribe({
        next: ({ restaurant }) => this.loadRestaurants(restaurant.city),
        error: () => this.loadRestaurants(this.locationService.current()),
      });
    } else {
      this.loadRestaurants(this.locationService.current());
    }
    this.friendsService.list().subscribe(({ friends }) => {
      this.friends.set(friends);
      const friendIds = new Set(friends.map((f) => f.id));
      this.profileService.matches().subscribe({
        next: ({ matches }) => this.suggestions.set(matches.filter((m) => !friendIds.has(m.id))),
        error: () => {},
      });
    });
  }

  private loadRestaurants(city: string): void {
    this.restaurantService.list({ city }).subscribe(({ restaurants }) => {
      this.restaurants.set(restaurants);
      if (!this.restaurantId && restaurants.length > 0) {
        this.restaurantId = restaurants[0].id;
      }
    });
  }

  selectGatheringType(type: string): void {
    this.gatheringType = type;
  }

  selectAtmosphere(atmosphere: string): void {
    this.atmosphere = atmosphere;
  }

  toggleFriendSelection(friendId: number): void {
    const selected = this.selectedFriendIds();
    this.selectedFriendIds.set(
      selected.includes(friendId) ? selected.filter((id) => id !== friendId) : [...selected, friendId],
    );
    this.aiSuggestion.set(null);
  }

  toggleInvitee(userId: number): void {
    const selected = this.selectedInviteeIds();
    this.selectedInviteeIds.set(
      selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId],
    );
  }

  toggleInviteDropdown(): void {
    this.inviteDropdownOpen.update((open) => !open);
  }

  @HostListener('document:click', ['$event'])
  private closeInviteDropdownOnOutsideClick(event: MouseEvent): void {
    if (!this.inviteDropdownOpen()) return;
    if (this.inviteDropdownContainer?.nativeElement.contains(event.target as Node)) return;
    this.inviteDropdownOpen.set(false);
  }

  getAiSuggestion(): void {
    const memberIds = this.selectedFriendIds();
    if (memberIds.length === 0 || this.aiSuggesting()) return;

    this.aiSuggesting.set(true);
    this.aiError.set(null);
    this.restaurantService.groupRecommendation(memberIds, this.locationService.current()).subscribe({
      next: ({ restaurant, reason, aiPowered }) => {
        // Keep the picked restaurant selectable even if it isn't in the
        // city list above (e.g. the list is still loading).
        if (!this.restaurants().some((r) => r.id === restaurant.id)) {
          this.restaurants.update((list) => [restaurant, ...list]);
        }
        this.restaurantId = restaurant.id;
        this.aiSuggestion.set({ restaurantName: restaurant.name, reason, aiPowered });
        this.aiSuggesting.set(false);
      },
      error: () => {
        this.aiError.set("Couldn't get a suggestion right now -- pick a restaurant above instead.");
        this.aiSuggesting.set(false);
      },
    });
  }

  submit(): void {
    if (!this.restaurantId || !this.date || !this.time || this.submitting()) {
      this.errorMessage.set('Please pick a restaurant, date, and time.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.tableService
      .create({
        restaurantId: this.restaurantId,
        gatheringType: this.gatheringType,
        dateTime: `${this.date}T${this.time}`,
        seatsTotal: this.seatsTotal,
        visibility: this.visibility ? 'public' : 'private',
        audience: this.visibility ? this.audience : 'everyone',
        atmosphere: this.atmosphere,
        note: this.note,
      })
      .subscribe({
        next: ({ table }) => {
          const inviteeIds = this.selectedInviteeIds();
          if (inviteeIds.length === 0) {
            this.go(`/guest-list/${table.id}`);
            return;
          }
          // The table is already created at this point -- an invite failure
          // shouldn't strand the host on this form or lose the table they
          // just made, so it navigates through either way.
          this.tableService.invite(table.id, inviteeIds).subscribe({
            next: () => this.go(`/guest-list/${table.id}`),
            error: () => this.go(`/guest-list/${table.id}`),
          });
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('Could not create the table. Please try again.');
        },
      });
  }
}
