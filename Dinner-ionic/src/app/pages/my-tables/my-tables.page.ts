import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-my-tables',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './my-tables.page.html',
  styleUrl: './my-tables.page.scss',
})
export class MyTablesPage extends BasePage {
  readonly pageTitle = "My Tables";
  readonly cityService = inject(LocationService);
}
