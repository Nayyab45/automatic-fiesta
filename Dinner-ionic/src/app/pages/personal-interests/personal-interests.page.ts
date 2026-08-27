import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { Interest, ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-personal-interests',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './personal-interests.page.html',
  styleUrl: './personal-interests.page.scss',
})
export class PersonalInterestsPage extends BasePage {
  readonly pageTitle = 'Personal Interests';
  private readonly profileService = inject(ProfileService);

  readonly interests = signal<Interest[]>([]);
  readonly selectedIds = signal(new Set<number>());
  readonly submitting = signal(false);

  constructor() {
    super();
    this.profileService.interests().subscribe(({ interests }) => this.interests.set(interests));
    this.profileService.me().subscribe(({ profile }) => {
      this.selectedIds.set(new Set(profile.interests.map((i) => i.id)));
    });
  }

  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  toggle(id: number): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedIds.set(next);
  }

  continue(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.profileService.setInterests(Array.from(this.selectedIds())).subscribe({
      next: () => this.go('/food-preferences'),
      error: () => this.go('/food-preferences'),
    });
  }
}
