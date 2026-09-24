import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, Renderer2, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';

/**
 * The logged-in user's own avatar: their uploaded photo if they've set one
 * (via manage-account or profile-creation), otherwise an initials circle --
 * replaces the identical hardcoded stock-photo placeholder that used to be
 * copy-pasted into every screen's header.
 *
 * Also doubles as the account menu trigger: tapping it opens a small panel
 * (name + age, View Profile, Settings, Log Out) rather than each page having
 * to wire up its own menu around the avatar it already shows.
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
    <button
      type="button"
      (click)="toggleMenu($event)"
      class="w-full h-full block p-0 m-0 border-0 bg-transparent cursor-pointer"
      aria-haspopup="menu"
      [attr.aria-expanded]="menuOpen()"
      aria-label="Account menu"
    >
      <img *ngIf="photoUrl()" [src]="photoUrl()" alt="Your profile photo" class="w-full h-full object-cover" />
      <div
        *ngIf="!photoUrl()"
        class="w-full h-full flex items-center justify-center bg-tertiary-container/30 text-tertiary font-title-lg text-title-lg"
      >
        {{ initial() }}
      </div>
    </button>

    <div
      #menuPanel
      [hidden]="!menuOpen()"
      (click)="$event.stopPropagation()"
      role="menu"
      class="fixed z-50 w-56 bg-surface rounded-xl ambient-shadow border-[0.5px] border-outline-variant overflow-hidden"
      [style.top.px]="menuPosition().top"
      [style.right.px]="menuPosition().right"
    >
      <div class="px-4 py-3 border-b border-outline-variant/50">
        <p class="font-title-md text-title-md text-on-surface truncate">{{ displayName() ?? 'Your account' }}</p>
        <p *ngIf="displayAge()" class="font-body-sm text-body-sm text-on-surface-variant">{{ displayAge() }} years</p>
      </div>
      <button
        type="button"
        role="menuitem"
        (click)="viewProfile()"
        class="w-full flex items-center gap-3 px-4 py-3 text-left font-body-md text-body-md text-on-surface hover:bg-surface-container-low transition-colors"
      >
        <span class="material-symbols-outlined text-lg text-on-surface-variant">person</span>
        View Profile
      </button>
      <button
        type="button"
        role="menuitem"
        (click)="openSettings()"
        class="w-full flex items-center gap-3 px-4 py-3 text-left font-body-md text-body-md text-on-surface hover:bg-surface-container-low transition-colors"
      >
        <span class="material-symbols-outlined text-lg text-on-surface-variant">settings</span>
        Settings
      </button>
      <button
        type="button"
        role="menuitem"
        (click)="logout()"
        class="w-full flex items-center gap-3 px-4 py-3 text-left font-body-md text-body-md text-error hover:bg-surface-container-low transition-colors"
      >
        <span class="material-symbols-outlined text-lg">logout</span>
        Log Out
      </button>
    </div>
  `,
  // Custom elements default to `display: inline`, which would silently
  // ignore any w-/h- class a call site puts directly on <app-user-avatar>
  // (needed at call sites whose wrapper div carried no sizing of its own --
  // only the old <img> did). Block avoids that footgun everywhere at once.
  styles: [':host { display: block; }'],
})
export class UserAvatarComponent implements AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  @ViewChild('menuPanel') private menuPanel?: ElementRef<HTMLElement>;

  readonly photoUrl = signal<string | null>(null);
  readonly initial = signal(this.authService.currentUser()?.name?.charAt(0)?.toUpperCase() ?? '?');
  readonly displayName = signal<string | null>(this.authService.currentUser()?.name ?? null);
  readonly displayAge = signal<number | null>(null);
  readonly menuOpen = signal(false);
  readonly menuPosition = signal({ top: 0, right: 16 });

  constructor() {
    // Ionic's route-reuse strategy (see main.ts) can keep this component
    // instance alive across a log-out/log-in-as-someone-else cycle, since a
    // page gets reused by route, not by which account is signed in -- a
    // constructor-only, one-shot `.me()` fetch left this avatar (and its
    // account menu) permanently showing whichever person was signed in when
    // the instance was first created. Reacting to currentUser() instead
    // means a change of account always refetches, whether this is a fresh
    // instance or a reused one.
    effect(
      () => {
        const user = this.authService.currentUser();
        this.photoUrl.set(null);
        this.initial.set(user?.name?.charAt(0)?.toUpperCase() ?? '?');
        this.displayName.set(user?.name ?? null);
        this.displayAge.set(null);
        if (!user) return;

        this.profileService.me().subscribe({
          next: ({ profile }) => {
            this.photoUrl.set(profile.photoUrl);
            this.initial.set(profile.name.charAt(0).toUpperCase());
            this.displayName.set(profile.name);
            this.displayAge.set(profile.age);
          },
          error: () => {},
        });
      },
      { allowSignalWrites: true },
    );
  }

  ngAfterViewInit(): void {
    // Every call site wraps this component in its own small circular avatar
    // div (`overflow-hidden`, for clipping the photo/initials -- see this
    // class's own doc comment). Since Angular renders the menu panel as a
    // DOM child of that same host, the wrapper's overflow-hidden ends up
    // affecting this `position: fixed` panel's compositing too on some
    // pages, even though `fixed` is meant to escape it -- it showed up as a
    // menu with the page content bleeding through instead of its own
    // background. Moving the node to <body> once it exists takes it out of
    // that ancestor for good.
    if (this.menuPanel) {
      this.renderer.appendChild(document.body, this.menuPanel.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.menuPanel?.nativeElement.remove();
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    if (!this.menuOpen()) {
      // Positioned from the avatar's own on-screen rect (rather than a
      // fixed offset) so the menu lines up correctly regardless of which
      // page's header it's rendered in -- it's portaled to <body> (see
      // ngAfterViewInit) so nothing about the avatar's own wrapper affects
      // where or how it renders.
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      this.menuPosition.set({ top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) });
    }
    this.menuOpen.update((open) => !open);
  }

  @HostListener('document:click')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  viewProfile(): void {
    this.menuOpen.set(false);
    this.router.navigateByUrl('/profile');
  }

  openSettings(): void {
    this.menuOpen.set(false);
    this.router.navigateByUrl('/settings');
  }

  logout(): void {
    this.menuOpen.set(false);
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
