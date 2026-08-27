import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { Person, ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-discover-people',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './discover-people.page.html',
  styleUrl: './discover-people.page.scss',
})
export class DiscoverPeoplePage extends BasePage {
  readonly pageTitle = 'Discover People';
  private readonly profileService = inject(ProfileService);

  readonly people = signal<Person[]>([]);
  readonly loading = signal(true);

  constructor() {
    super();
    this.profileService.people().subscribe({
      next: ({ people }) => {
        this.people.set(people);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleChip(event: Event): void {
    (event.currentTarget as HTMLElement).classList.toggle('chip-selected');
  }
}
