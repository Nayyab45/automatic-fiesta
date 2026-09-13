import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';

// This is Home's "Find Table" destination -- distinct from /my-tables (the
// user's own tables). It shows other people's public, joinable tables, with
// the original prototype's static empty-state art as the fallback once
// there genuinely are none.
@Component({
  selector: 'app-empty-state-table',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, HeaderComponent],
  templateUrl: './empty-state-table.page.html',
  styleUrl: './empty-state-table.page.scss',
})
export class EmptyStateTablePage extends BasePage {
  readonly pageTitle = "Discover Tables";
  private readonly tableService = inject(DiningTableService);

  readonly loading = signal(true);
  readonly tables = signal<DiningTable[]>([]);

  constructor() {
    super();
    this.tableService.discover().subscribe({
      next: ({ tables }) => {
        this.tables.set(tables);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
