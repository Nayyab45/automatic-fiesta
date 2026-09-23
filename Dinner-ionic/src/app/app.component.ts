import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRouterOutlet } from '@ionic/angular/standalone';
import { NetworkService } from './services/network.service';
import { PushNotificationService } from './services/push-notification.service';

// PILOT: swapped from a plain <router-outlet> to <ion-router-outlet> to
// validate whether real Ionic components (native transitions, swipe-back)
// can be adopted app-wide without repeating the earlier blank-screen bug
// (see project history) -- BasePage now stamps the `ion-page` class on
// every routed component via @HostBinding (added earlier this session),
// which is what ion-router-outlet actually requires and what was missing
// before. Confirmed via manual navigation across converted and
// unconverted pages alike; see the pilot pages themselves
// (home/login/discover-restaurants) for the actual ion-content adoption.
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, IonRouterOutlet],
  template: `
    <div
      *ngIf="!network.isOnline()"
      class="fixed top-0 left-0 w-full z-[1000] bg-error text-on-error font-label-lg text-label-lg text-center py-2 flex items-center justify-center gap-2"
      style="padding-top: max(8px, env(safe-area-inset-top, 8px));"
    >
      <span class="material-symbols-outlined text-[18px]">wifi_off</span>
      You're offline
    </div>

    <div
      *ngIf="push.banner() as notification"
      (click)="push.onBannerTapped()"
      role="button"
      tabindex="0"
      (keydown.enter)="$event.target === $event.currentTarget && push.onBannerTapped()"
      (keydown.space)="$event.target === $event.currentTarget && $event.preventDefault(); $event.target === $event.currentTarget && push.onBannerTapped()"
      class="fixed left-4 right-4 z-[2000] bg-on-background text-cream-background rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3 active:scale-[0.98] transition-transform"
      style="top: max(12px, env(safe-area-inset-top, 12px));"
    >
      <span class="material-symbols-outlined text-[22px] shrink-0" style="font-variation-settings: 'FILL' 1;">notifications</span>
      <div class="min-w-0 flex-1">
        <p class="font-bold text-[14px] truncate">{{ notification.title }}</p>
        <p class="text-[13px] opacity-90 truncate">{{ notification.body }}</p>
      </div>
      <button (click)="dismissBanner($event)" aria-label="Dismiss" class="shrink-0">
        <span class="material-symbols-outlined text-[18px] opacity-70">close</span>
      </button>
    </div>

    <ion-router-outlet></ion-router-outlet>
  `,
})
export class AppComponent implements OnInit {
  readonly push = inject(PushNotificationService);

  constructor(public network: NetworkService) {}

  ngOnInit(): void {
    void this.push.init();
  }

  dismissBanner(event: Event): void {
    event.stopPropagation();
    this.push.dismissBanner();
  }
}
