import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-profile-creation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile-creation.page.html',
  styleUrl: './profile-creation.page.scss',
})
export class ProfileCreationPage {
  readonly pageTitle = "Profile Creation";

  private readonly citiesByProvince: Record<string, string[]> = {
    punjab: ['Lahore', 'Faisalabad', 'Multan', 'Rawalpindi', 'Gujranwala'],
    sindh: ['Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Mirpur Khas'],
    kpk: ['Peshawar', 'Mardan', 'Abbottabad', 'Swat'],
    balochistan: ['Quetta', 'Gwadar', 'Khuzdar'],
    islamabad: ['Islamabad'],
    'gilgit-baltistan': ['Gilgit', 'Skardu'],
    ajk: ['Muzaffarabad', 'Mirpur', 'Rawalakot'],
  };

  cities: { value: string; label: string }[] = [];
  favoriteFoods = ['Karahi', 'Biryani', 'Seekh Kebab'];

  constructor(private router: Router, private location: Location) {}

  addFavoriteFood(): void {
    const value = window.prompt('Add a favorite food');
    if (value?.trim()) this.favoriteFoods.push(value.trim());
  }

  removeFavoriteFood(index: number): void {
    this.favoriteFoods.splice(index, 1);
  }

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  onProvinceChange(event: Event): void {
    const province = (event.target as HTMLSelectElement).value;
    const list = this.citiesByProvince[province] ?? [];
    this.cities = list.map((city) => ({ value: city.toLowerCase().replace(/ /g, '-'), label: city }));
  }
}
