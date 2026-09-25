import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { Share } from '@capacitor/share';
import { BasePage } from '../base.page';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-safety-checkin',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './safety-checkin.page.html',
  styleUrl: './safety-checkin.page.scss',
})
export class SafetyCheckinPage extends BasePage {
  readonly pageTitle = "Safety Check-in";
  private readonly tableService = inject(DiningTableService);

  readonly table = signal<DiningTable | null>(null);
  readonly loading = signal(true);
  readonly checkedIn = signal(false);
  readonly sharingLocation = signal(false);

  constructor() {
    super();
    // Ionic's route-reuse strategy (see main.ts) can keep this page's
    // component instance alive across visits -- a constructor-only, one-shot
    // fetch of the check-in status froze this screen on whatever it was when
    // first created, so leaving and coming back (e.g. after actually
    // checking in) could show a stale "not checked in" state instead of
    // reflecting what's actually saved server-side. Reacting to routeId()
    // via effect() means every visit re-fetches the real current status.
    effect(
      () => {
        const id = this.routeId();
        this.loading.set(true);
        this.table.set(null);
        this.checkedIn.set(false);
        if (!id) {
          this.loading.set(false);
          return;
        }
        this.tableService.get(id).subscribe({
          next: ({ table }) => {
            this.table.set(table);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
        this.tableService.myCheckIn(id).subscribe(({ checkIn }) => this.checkedIn.set(!!checkIn && !checkIn.checkedOutAt));
      },
      { allowSignalWrites: true },
    );
  }

  checkIn(): void {
    const id = this.routeId();
    if (!id) return;
    this.tableService.checkIn(id).subscribe(() => {
      this.checkedIn.set(true);
      // No SMS/email provider is configured on this backend, so this is the
      // actual delivery path for "your emergency contact knows you arrived"
      // today -- the OS share sheet, prefilled with a live-location link,
      // rather than an automatic send this app has no way to actually place.
      void this.shareLiveLocation();
    });
  }

  /** Shares a Google Maps link to the caller's current GPS position via the
   * OS share sheet (WhatsApp, SMS, email -- whatever's installed), same
   * Share.share + clipboard-fallback pattern as table-details-guests.page.ts
   * and restaurant-detail.page.ts. Falls back to the restaurant's own
   * address if GPS is denied/unavailable, so a share still goes out with
   * *some* useful location instead of silently doing nothing. */
  async shareLiveLocation(): Promise<void> {
    const table = this.table();
    if (!table || this.sharingLocation()) return;
    this.sharingLocation.set(true);
    try {
      let mapsUrl: string | undefined;
      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
        const { latitude, longitude } = position.coords;
        mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      } catch {
        mapsUrl = undefined;
      }

      const arrivedLine = `I've arrived safely at ${table.restaurant.name}${table.restaurant.address ? `, ${table.restaurant.address}` : ''}.`;
      const shareData = mapsUrl
        ? { title: 'My Live Location', text: `${arrivedLine} Here's my live location:`, url: mapsUrl }
        : { title: 'My Live Location', text: arrivedLine };
      try {
        await Share.share(shareData);
      } catch {
        navigator.clipboard?.writeText(mapsUrl ? `${shareData.text} ${mapsUrl}` : shareData.text).catch(() => {});
      }
    } finally {
      this.sharingLocation.set(false);
    }
  }

  checkOut(): void {
    const id = this.routeId();
    if (!id || !this.checkedIn()) return;
    // Stay right here rather than jumping to the general Safety Center
    // info page -- checking out isn't a dead end, it's just a status
    // update, and this screen already reflects it (the button disables,
    // "Not checked in" shows again).
    this.tableService.checkOut(id).subscribe(() => this.checkedIn.set(false));
  }

  callForHelp(): void {
    window.location.href = 'tel:1122';
  }
}
