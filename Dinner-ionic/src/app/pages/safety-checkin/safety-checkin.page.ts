import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
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
    this.tableService.checkIn(id).subscribe(() => this.checkedIn.set(true));
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
