import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BlockedUser, SafetyService } from '../../services/safety.service';

@Component({
  selector: 'app-blocked-users',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blocked-users.page.html',
  styleUrl: './blocked-users.page.scss',
})
export class BlockedUsersPage extends BasePage {
  readonly pageTitle = "Blocked Users";
  private readonly safetyService = inject(SafetyService);

  readonly blocked = signal<BlockedUser[]>([]);
  readonly loading = signal(true);

  constructor() {
    super();
    this.safetyService.blockedUsers().subscribe({
      next: ({ blocked }) => {
        this.blocked.set(blocked);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  unblock(user: BlockedUser): void {
    this.safetyService.unblock(user.userId).subscribe(() => {
      this.blocked.update((list) => list.filter((u) => u.userId !== user.userId));
    });
  }
}
