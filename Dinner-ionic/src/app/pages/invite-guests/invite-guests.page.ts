import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { DiningTableService } from '../../services/dining-table.service';
import { Friend, FriendsService } from '../../services/friends.service';
import { Match, ProfileService } from '../../services/profile.service';

// Invites more people to a table that already exists -- separate from
// create-table.page.ts's picker, which only ever fires once, right after
// the table itself is created. This reuses the same invite() endpoint
// (POST /:id/invites already tolerates being called repeatedly -- it skips
// existing members and already-pending invites server-side) against a
// table id passed in the route instead.
@Component({
  selector: 'app-invite-guests',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './invite-guests.page.html',
  styleUrl: './invite-guests.page.scss',
})
export class InviteGuestsPage extends BasePage {
  readonly pageTitle = 'Send Request';
  private readonly tableService = inject(DiningTableService);
  private readonly friendsService = inject(FriendsService);
  private readonly profileService = inject(ProfileService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly sent = signal(false);

  readonly friends = signal<Friend[]>([]);
  readonly suggestions = signal<Match[]>([]);
  readonly existingGuestIds = signal<Set<number>>(new Set());
  readonly selectedIds = signal<number[]>([]);
  readonly filterText = signal('');

  readonly filteredFriends = computed(() => {
    const q = this.filterText().trim().toLowerCase();
    const list = this.friends().filter((f) => !this.existingGuestIds().has(f.id));
    return q ? list.filter((f) => f.name.toLowerCase().includes(q)) : list;
  });
  readonly filteredSuggestions = computed(() => {
    const q = this.filterText().trim().toLowerCase();
    const list = this.suggestions().filter((s) => !this.existingGuestIds().has(s.id));
    return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list;
  });

  private readonly tableId: string | null;

  constructor() {
    super();
    this.tableId = this.routeId();
    if (!this.tableId) {
      this.loading.set(false);
      return;
    }

    this.tableService.guests(this.tableId).subscribe({
      next: ({ guests }) => this.existingGuestIds.set(new Set(guests.map((g) => g.id))),
      error: () => {},
    });
    this.friendsService.list().subscribe({
      next: ({ friends }) => {
        this.friends.set(friends);
        const friendIds = new Set(friends.map((f) => f.id));
        this.profileService.matches().subscribe({
          next: ({ matches }) => {
            this.suggestions.set(matches.filter((m) => !friendIds.has(m.id)));
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  toggleSelect(userId: number): void {
    const selected = this.selectedIds();
    this.selectedIds.set(selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId]);
  }

  send(): void {
    if (!this.tableId || this.selectedIds().length === 0 || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.tableService.invite(this.tableId, this.selectedIds()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.sent.set(true);
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('Could not send the invites. Please try again.');
      },
    });
  }
}
