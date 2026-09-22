import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RootHeaderComponent } from '../../components/root-header/root-header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { LocationService } from '../../services/location.service';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';

@Component({
  selector: 'app-my-tables',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, UserAvatarComponent, RootHeaderComponent],
  templateUrl: './my-tables.page.html',
  styleUrl: './my-tables.page.scss',
})
export class MyTablesPage extends BasePage {
  readonly pageTitle = 'My Tables';
  readonly cityService = inject(LocationService);
  private readonly tableService = inject(DiningTableService);

  readonly loading = signal(true);
  readonly tables = signal<DiningTable[]>([]);
  readonly upcoming = computed(() => this.tables().filter((t) => !t.isPast));
  readonly past = computed(() => this.tables().filter((t) => t.isPast));

  // ion-router-outlet keeps this page's component instance alive across
  // navigations away and back (see discover-restaurants.page.ts's own note
  // on this) -- fetching once in the constructor instead of here left a
  // table that was upcoming when this page first loaded stuck showing as
  // "upcoming" forever, even long after its date_time actually passed,
  // since nothing ever re-checked. ionViewWillEnter is Ionic's own
  // lifecycle event for "this page just became the active view", firing on
  // the first entrance same as every revisit, so it replaces the
  // constructor call rather than duplicating it.
  @HostListener('ionViewWillEnter')
  private reload(): void {
    this.loading.set(true);
    this.tableService.listMine().subscribe({
      next: ({ tables }) => {
        this.tables.set(tables);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
