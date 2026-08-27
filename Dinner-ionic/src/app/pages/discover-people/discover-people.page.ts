import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-discover-people',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './discover-people.page.html',
  styleUrl: './discover-people.page.scss',
})
export class DiscoverPeoplePage extends BasePage {
  readonly pageTitle = "Discover People";

  toggleChip(event: Event): void {
    (event.currentTarget as HTMLElement).classList.toggle('chip-selected');
  }
}
