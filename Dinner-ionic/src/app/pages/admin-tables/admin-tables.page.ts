import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { AdminService, AdminTable } from '../../services/admin.service';

@Component({
  selector: 'app-admin-tables',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './admin-tables.page.html',
  styleUrl: './admin-tables.page.scss',
})
export class AdminTablesPage extends BasePage {
  readonly pageTitle = 'Event Management';
  private readonly adminService = inject(AdminService);

  private readonly allTables = signal<AdminTable[]>([]);
  readonly query = signal('');
  readonly onlyPublic = signal(false);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly deletingId = signal<number | null>(null);

  readonly tables = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.allTables().filter(
      (t) =>
        (!this.onlyPublic() || t.visibility === 'public') &&
        (!q || [t.title, t.hostName, t.restaurantName].some((v) => v.toLowerCase().includes(q))),
    );
  });

  constructor() {
    super();
    this.adminService.tables().subscribe({
      next: ({ tables }) => {
        this.allTables.set(tables);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.forbidden.set(err.status === 403);
        this.loading.set(false);
      },
    });
  }

  remove(table: AdminTable): void {
    if (this.deletingId()) return;
    if (!confirm(`Remove "${table.title}" hosted by ${table.hostName}? Its guests, messages and reviews are deleted too.`)) return;
    this.deletingId.set(table.id);
    this.adminService.deleteTable(table.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.allTables.update((list) => list.filter((t) => t.id !== table.id));
      },
      error: () => this.deletingId.set(null),
    });
  }
}
