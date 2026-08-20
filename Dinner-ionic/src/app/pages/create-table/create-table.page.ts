import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-create-table',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './create-table.page.html',
  styleUrl: './create-table.page.scss',
})
export class CreateTablePage {
  readonly pageTitle = "Create Table";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  selectGatheringType(event: Event): void {
    const selected = event.currentTarget as HTMLElement;
    const group = selected.parentElement?.querySelectorAll('.gathering-type-btn') ?? [];
    group.forEach((btn) => btn.classList.remove('gathering-type-selected'));
    selected.classList.add('gathering-type-selected');
  }

  selectAtmosphere(event: Event): void {
    const selected = event.currentTarget as HTMLElement;
    const group = selected.parentElement?.querySelectorAll('.atmosphere-card') ?? [];
    group.forEach((card) => card.classList.remove('atmosphere-selected'));
    selected.classList.add('atmosphere-selected');
  }
}
