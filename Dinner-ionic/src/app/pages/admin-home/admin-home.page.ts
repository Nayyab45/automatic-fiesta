import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { AdminService, AdminStats } from '../../services/admin.service';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './admin-home.page.html',
  styleUrl: './admin-home.page.scss',
})
export class AdminHomePage extends BasePage {
  readonly pageTitle = 'Admin';
  private readonly adminService = inject(AdminService);

  readonly stats = signal<AdminStats | null>(null);

  constructor() {
    super();
    this.adminService.stats().subscribe({ next: (stats) => this.stats.set(stats), error: () => {} });
  }
}
