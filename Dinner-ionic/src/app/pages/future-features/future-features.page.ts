import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { AuthService } from '../../services/auth.service';
import { WaitlistService } from '../../services/waitlist.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-future-features',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, BottomNavComponent, UserAvatarComponent],
  templateUrl: './future-features.page.html',
  styleUrl: './future-features.page.scss',
})
export class FutureFeaturesPage extends BasePage {
  readonly pageTitle = "Future Features";
  private readonly authService = inject(AuthService);
  private readonly waitlistService = inject(WaitlistService);

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);

  email = this.authService.currentUser()?.email ?? '';

  notifyMe(): void {
    if (this.submitting() || this.submitted()) return;

    const email = this.email.trim();
    if (!EMAIL_RE.test(email)) {
      this.errorMessage.set('Enter a valid email address');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.waitlistService.join(email).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.message ?? 'Something went wrong. Please try again.');
      },
    });
  }
}
