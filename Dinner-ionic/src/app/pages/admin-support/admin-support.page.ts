import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { SupportMessage, SupportService } from '../../services/support.service';

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './admin-support.page.html',
  styleUrl: './admin-support.page.scss',
})
export class AdminSupportPage extends BasePage {
  readonly pageTitle = 'Support Messages';
  private readonly supportService = inject(SupportService);

  readonly messages = signal<SupportMessage[]>([]);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly resolvingId = signal<number | null>(null);

  constructor() {
    super();
    this.supportService.list().subscribe({
      next: ({ messages }) => {
        this.messages.set(messages);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.forbidden.set(err.status === 403);
        this.loading.set(false);
      },
    });
  }

  resolve(message: SupportMessage): void {
    if (this.resolvingId()) return;
    this.resolvingId.set(message.id);
    this.supportService.resolve(message.id).subscribe({
      next: () => {
        this.resolvingId.set(null);
        this.messages.update((list) => list.map((m) => (m.id === message.id ? { ...m, status: 'resolved' as const } : m)));
      },
      error: () => this.resolvingId.set(null),
    });
  }
}
