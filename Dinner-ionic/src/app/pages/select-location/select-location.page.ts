import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { City, LocationService } from '../../services/location.service';

interface ProvinceGroup {
  region: string;
  cities: City[];
}

@Component({
  selector: 'app-select-location',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './select-location.page.html',
  styleUrl: './select-location.page.scss',
})
export class SelectLocationPage extends BasePage {
  readonly pageTitle = 'Select Location';
  readonly cityService = inject(LocationService);

  readonly filterText = signal('');

  // The full list is ~190 entries across the country, so it's grouped by
  // province (like the data already is) and narrowed by a text filter --
  // otherwise it's an unbrowsable wall of names.
  readonly groups = computed<ProvinceGroup[]>(() => {
    const filter = this.filterText().trim().toLowerCase();
    const matches = filter
      ? this.cityService.cities.filter((city) => city.name.toLowerCase().includes(filter))
      : this.cityService.cities;

    const byRegion = new Map<string, City[]>();
    for (const city of matches) {
      const list = byRegion.get(city.region) ?? [];
      list.push(city);
      byRegion.set(city.region, list);
    }
    return Array.from(byRegion, ([region, cities]) => ({ region, cities }));
  });

  onFilterInput(value: string): void {
    this.filterText.set(value);
  }

  selectCity(name: string): void {
    this.cityService.setCity(name);
    this.goBack();
  }
}
