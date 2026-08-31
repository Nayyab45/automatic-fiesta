import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';

/**
 * The logged-in user's own avatar: their uploaded photo if they've set one
 * (via manage-account or profile-creation), otherwise an initials circle --
 * replaces the identical hardcoded stock-photo placeholder that used to be
 * copy-pasted into every screen's header.
 *
 * Deliberately unstyled for size/shape: fills whatever fixed-size,
 * rounded, overflow-hidden wrapper div the call site already has (every
 * header on this app already has one), rather than taking size inputs.
 */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img *ngIf="photoUrl()" [src]="photoUrl()" alt="Your profile photo" class="w-full h-full object-cover" />
    <div
      *ngIf="!photoUrl()"
      class="w-full h-full flex items-center justify-center bg-tertiary-container/30 text-tertiary font-title-lg text-title-lg"
    >
      {{ initial() }}
    </div>
  `,
  // Custom elements default to `display: inline`, which would silently
  // ignore any w-/h- class a call site puts directly on <app-user-avatar>
  // (needed at call sites whose wrapper div carried no sizing of its own --
  // only the old <img> did). Block avoids that footgun everywhere at once.
  styles: [':host { display: block; }'],
})
export class UserAvatarComponent {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  readonly photoUrl = signal<string | null>(null);
  readonly initial = signal(this.authService.currentUser()?.name?.charAt(0)?.toUpperCase() ?? '?');

  constructor() {
    this.profileService.me().subscribe({
      next: ({ profile }) => {
        this.photoUrl.set(profile.photoUrl);
        this.initial.set(profile.name.charAt(0).toUpperCase());
      },
      error: () => {},
    });
  }
}
