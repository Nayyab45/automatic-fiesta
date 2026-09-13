import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { Profile, ProfileService } from '../../services/profile.service';
import { SafetyService } from '../../services/safety.service';

const REASONS = [
  'Inappropriate behavior or messages',
  'Harassment or threats',
  'Fake profile / impersonation',
  'Solicitation or scam',
  'No-show without notice',
  'Made me feel unsafe',
  'Other',
];

@Component({
  selector: 'app-report-users',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HeaderComponent],
  templateUrl: './report-users.page.html',
  styleUrl: './report-users.page.scss',
})
export class ReportUsersPage extends BasePage {
  readonly pageTitle = "Report User";
  private readonly profileService = inject(ProfileService);
  private readonly safetyService = inject(SafetyService);

  readonly reasons = REASONS;
  readonly person = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);

  reason = '';
  details = '';
  alsoBlock = false;

  constructor() {
    super();
    const id = this.routeId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.profileService.get(id).subscribe({
      next: ({ profile }) => {
        this.person.set(profile);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    const person = this.person();
    if (!person || !this.reason || this.submitting()) return;

    this.submitting.set(true);
    this.safetyService.report(person.id, this.reason, this.details.trim() || undefined, this.alsoBlock).subscribe({
      next: () => this.goBack(),
      error: () => this.submitting.set(false),
    });
  }
}
