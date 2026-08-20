import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-edit-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './edit-preferences.page.html',
  styleUrl: './edit-preferences.page.scss',
})
export class EditPreferencesPage {
  readonly pageTitle = "Edit Preferences";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

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
