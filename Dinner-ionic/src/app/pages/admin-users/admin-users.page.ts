import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { AdminService, AdminUserRow, AdminUserStatusFilter } from '../../services/admin.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss',
})
export class AdminUsersPage extends BasePage {
  readonly pageTitle = 'User Management';
  private readonly adminService = inject(AdminService);

  readonly filters: { label: string; value: AdminUserStatusFilter }[] = [
    { label: 'All', value: '' },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Flagged', value: 'flagged' },
    { label: 'Unverified', value: 'unverified' },
    { label: 'Admins', value: 'admin' },
  ];

  readonly users = signal<AdminUserRow[]>([]);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  search = '';
  status: AdminUserStatusFilter = '';

  constructor() {
    super();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.adminService.users(this.search.trim(), this.status).subscribe({
      next: ({ users }) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.forbidden.set(err.status === 403);
        this.loading.set(false);
      },
    });
  }

  selectStatus(value: AdminUserStatusFilter): void {
    this.status = value;
    this.load();
  }
}
