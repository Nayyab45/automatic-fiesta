import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePage } from '../base.page';
import { ProfileService } from '../../services/profile.service';
import { LocationService } from '../../services/location.service';
import { resizeImageToDataUrl } from '../../shared/image-resize';
import { PAKISTAN_CITIES } from '../../data/pakistan-cities';
import { Gender } from '../../services/profile.service';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// Pakistan's 4 official provinces. Islamabad (a federal territory, not a
// province), Azad Kashmir and Gilgit-Baltistan are deliberately left out of
// this list -- they're still valid `region` values in PAKISTAN_CITIES (and
// so still reachable through Select Location's city picker), just not
// offered as "Province" choices here.
const OFFICIAL_PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan'];

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
  private readonly locationService = inject(LocationService);

  // /profile-creation also serves as the "Edit Profile" screen for existing
  // users (see profile.page.html) -- ?mode=edit stops submit() from chaining
  // into the rest of the new-user onboarding wizard (personal-interests ->
  // food-preferences -> dietary-preferences), since none of that belongs to
  // an in-place profile edit.
  readonly isEditMode = this.route.snapshot.queryParamMap.get('mode') === 'edit';

  readonly provinces = OFFICIAL_PROVINCES;
  readonly genderOptions = GENDER_OPTIONS;

  cities: string[] = [];
  favoriteFoods: string[] = [];
  name = '';
  age: number | null = null;
  province = '';
  city = '';
  bio = '';
  gender: Gender | '' = '';
  avatarUrl: string | null = null;
  readonly submitting = signal(false);

  constructor() {
    super();
    this.profileService.me().subscribe(({ profile }) => {
      this.name = profile.name;
      this.age = profile.age;
      this.province = profile.province ?? '';
      this.city = profile.city ?? '';
      this.bio = profile.bio ?? '';
      this.gender = profile.gender ?? '';
      this.favoriteFoods = profile.favoriteFoods;
      this.avatarUrl = profile.photoUrl;
      this.cities = this.citiesForProvince(this.province);
    });
  }

  private citiesForProvince(province: string): string[] {
    return PAKISTAN_CITIES.filter((c) => c.region === province).map((c) => c.name);
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
    this.cities = this.citiesForProvince(province);
    // The previously picked city almost certainly isn't in the new
    // province's list -- clear it rather than leave a stale, invalid value.
    if (!this.cities.includes(this.city)) this.city = '';
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    const next = this.isEditMode ? '/profile' : '/personal-interests';
    this.profileService
      .updateMe({
        age: this.age ?? undefined,
        bio: this.bio,
        city: this.city,
        province: this.province,
        gender: this.gender || undefined,
      })
      .subscribe({
        next: () => {
          // The city picked here is the user's home city -- keep it in sync
          // with LocationService's home/browsing city (normally only set via
          // /select-location) so it doesn't silently show a stale or
          // never-set city, and so picking a *different* city later via
          // Select Location reads as "traveling" rather than as this home
          // city having silently changed.
          if (this.city) this.locationService.setHomeCity(this.city);
          this.profileService.setFoodPreferences(this.favoriteFoods).subscribe(() => this.go(next));
        },
        error: () => {
          this.submitting.set(false);
          this.go(next);
        },
      });
  }
}
