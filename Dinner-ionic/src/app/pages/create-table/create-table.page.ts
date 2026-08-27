import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-create-table',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './create-table.page.html',
  styleUrl: './create-table.page.scss',
})
export class CreateTablePage extends BasePage {
  readonly pageTitle = "Create Table";

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
