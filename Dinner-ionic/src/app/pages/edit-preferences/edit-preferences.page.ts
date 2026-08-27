import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-edit-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './edit-preferences.page.html',
  styleUrl: './edit-preferences.page.scss',
})
export class EditPreferencesPage extends BasePage {
  readonly pageTitle = "Edit Preferences";

  toggleChip(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    el.classList.toggle('chip-selected');
    el.querySelector('.chip-check')?.classList.toggle('hidden');
  }

  selectSegment(event: Event): void {
    const selected = event.currentTarget as HTMLElement;
    const group = selected.parentElement?.querySelectorAll('.segment-btn') ?? [];
    group.forEach((btn) => btn.classList.remove('segment-selected'));
    selected.classList.add('segment-selected');
  }
}
