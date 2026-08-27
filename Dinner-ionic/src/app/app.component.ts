import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NetworkService } from './services/network.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div
      *ngIf="!network.isOnline()"
      class="fixed top-0 left-0 w-full z-[1000] bg-error text-on-error font-label-lg text-label-lg text-center py-2 flex items-center justify-center gap-2"
      style="padding-top: max(8px, env(safe-area-inset-top, 8px));"
    >
      <span class="material-symbols-outlined text-[18px]">wifi_off</span>
      You're offline
    </div>
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {
  constructor(public network: NetworkService) {}
}
