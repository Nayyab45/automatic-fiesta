import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-empty-state-table',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './empty-state-table.page.html',
  styleUrl: './empty-state-table.page.scss',
})
export class EmptyStateTablePage extends BasePage {
  readonly pageTitle = "My Tables (Empty)";
}
