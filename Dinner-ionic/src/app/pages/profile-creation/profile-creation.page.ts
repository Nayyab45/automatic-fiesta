import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { ProfileService } from '../../services/profile.service';
import { resizeImageToDataUrl } from '../../shared/image-resize';

@Component({
  selector: 'app-profile-creation',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './profile-creation.page.html',
  styleUrl: './profile-creation.page.scss',
})
export class ProfileCreationPage extends BasePage {
  readonly pageTitle = 'Profile Creation';
  private readonly profileService = inject(ProfileService);

  private readonly citiesByProvince: Record<string, string[]> = {
    punjab: ['Lahore', 'Faisalabad', 'Multan', 'Rawalpindi', 'Gujranwala'],
    sindh: ['Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Mirpur Khas'],
    kpk: ['Peshawar', 'Mardan', 'Abbottabad', 'Swat'],
    balochistan: ['Quetta', 'Gwadar', 'Khuzdar'],
    islamabad: ['Islamabad'],
    'gilgit-baltistan': ['Gilgit', 'Skardu'],
    ajk: ['Muzaffarabad', 'Mirpur', 'Rawalakot'],
  };

  cities: string[] = [];
  favoriteFoods: string[] = [];
  name = '';
  age: number | null = null;
  province = '';
  city = '';
  bio = '';
  avatarUrl: string | null = null;
  readonly submitting = signal(false);

  constructor() {
    super();
    this.profileService.me().subscribe(({ profile }) => {
      this.name = profile.name;
      this.age = profile.age;
      this.city = profile.city ?? '';
      this.bio = profile.bio ?? '';
      this.favoriteFoods = profile.favoriteFoods;
      this.avatarUrl = profile.photoUrl;
    });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    resizeImageToDataUrl(file)
      .then((dataUrl) => {
        this.profileService.updateMe({ photoUrl: dataUrl }).subscribe({
          next: ({ profile }) => (this.avatarUrl = profile.photoUrl ?? dataUrl),
          error: (err) => window.alert(err?.error?.message ?? 'Could not upload photo. Please try again.'),
        });
      })
      .catch((err) => window.alert(err?.message ?? 'Could not process the selected image.'))
      .finally(() => (input.value = ''));
  }

  addFavoriteFood(): void {
    const value = window.prompt('Add a favorite food');
    if (value?.trim()) this.favoriteFoods.push(value.trim());
  }

  removeFavoriteFood(index: number): void {
    this.favoriteFoods.splice(index, 1);
  }

  onProvinceChange(event: Event): void {
    const province = (event.target as HTMLSelectElement).value;
    this.cities = this.citiesByProvince[province] ?? [];
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    this.profileService.updateMe({ age: this.age ?? undefined, bio: this.bio, city: this.city, province: this.province }).subscribe({
      next: () => this.profileService.setFoodPreferences(this.favoriteFoods).subscribe(() => this.go('/personal-interests')),
      error: () => {
        this.submitting.set(false);
        this.go('/personal-interests');
      },
    });
  }
}
