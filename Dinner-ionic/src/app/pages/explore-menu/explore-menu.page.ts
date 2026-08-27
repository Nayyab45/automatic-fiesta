import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-explore-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './explore-menu.page.html',
  styleUrl: './explore-menu.page.scss',
})
export class ExploreMenuPage extends BasePage {
  readonly pageTitle = "Explore Menu";
  readonly cityService = inject(LocationService);

  toggleChip(event: Event): void {
    (event.currentTarget as HTMLElement).classList.toggle('chip-selected');
  }
}
