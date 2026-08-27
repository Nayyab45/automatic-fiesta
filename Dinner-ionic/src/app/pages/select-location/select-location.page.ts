import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-select-location',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './select-location.page.html',
  styleUrl: './select-location.page.scss',
})
export class SelectLocationPage extends BasePage {
  readonly pageTitle = 'Select Location';
  readonly cityService = inject(LocationService);

  selectCity(name: string): void {
    this.cityService.setCity(name);
    this.goBack();
  }
}
