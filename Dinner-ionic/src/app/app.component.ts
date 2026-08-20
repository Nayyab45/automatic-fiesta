import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { NetworkService } from './services/network.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, IonApp, IonRouterOutlet],
  template: `
    <div
      *ngIf="!network.isOnline()"
      class="fixed top-0 left-0 w-full z-[1000] bg-error text-on-error font-label-lg text-label-lg text-center py-2 flex items-center justify-center gap-2"
      style="padding-top: max(8px, env(safe-area-inset-top, 8px));"
    >
      <span class="material-symbols-outlined text-[18px]">wifi_off</span>
      You're offline
    </div>
    <ion-app>
      <ion-router-outlet [animated]="false"></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent {
  constructor(public network: NetworkService) {}
}
