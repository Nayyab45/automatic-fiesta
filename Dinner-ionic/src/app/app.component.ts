import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRouterOutlet } from '@ionic/angular/standalone';
import { NetworkService } from './services/network.service';

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
    <ion-router-outlet></ion-router-outlet>
  `,
})
export class AppComponent {
  constructor(public network: NetworkService) {}
}
