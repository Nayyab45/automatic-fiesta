import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-select-location',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './select-location.page.html',
  styleUrl: './select-location.page.scss',
})
export class SelectLocationPage {
  readonly pageTitle = 'Select Location';

  constructor(
    private router: Router,
    private location: Location,
    public cityService: LocationService,
  ) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  selectCity(name: string): void {
    this.cityService.setCity(name);
    this.goBack();
  }
}
