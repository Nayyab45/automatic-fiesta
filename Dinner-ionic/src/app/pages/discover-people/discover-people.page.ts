import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { Interest, Person, ProfileService } from '../../services/profile.service';
import { MessagingService } from '../../services/messaging.service';

// Same curated vocabulary Food Preferences lets a person pick their own
// favorites from (food-preferences.page.ts's pakistaniFavorites) -- matching
// against that same list here is what makes the "Cuisine" filter mean
// something (it's substring-matched against favorite_foods server-side, see
// profile.js's peopleRouter).
const CUISINE_OPTIONS = ['Biryani', 'Karahi', 'Nihari', 'Haleem', 'BBQ', 'Kebabs', 'Handi', 'Qorma', 'Pulao', 'Sajji'];

const DISTANCE_OPTIONS_KM = [5, 10, 25, 50];

@Component({
  selector: 'app-discover-people',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BottomNavComponent, HeaderComponent],
  templateUrl: './discover-people.page.html',
  styleUrl: './discover-people.page.scss',
})
export class DiscoverPeoplePage extends BasePage {
  readonly pageTitle = 'Discover People';
  private readonly profileService = inject(ProfileService);
  private readonly messagingService = inject(MessagingService);

  readonly people = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly filterSheetOpen = signal(false);

  readonly cuisineOptions = CUISINE_OPTIONS;
  readonly distanceOptionsKm = DISTANCE_OPTIONS_KM;
  readonly allInterests = signal<Interest[]>([]);

  // Draft state, only applied to the actual list when "Apply Filters" is
  // tapped -- so opening the sheet and backing out of it doesn't change
  // results underneath the person still looking at the list.
  minAge: number | null = null;
  maxAge: number | null = null;
  selectedInterestIds = new Set<number>();
  selectedCuisines = new Set<string>();
  selectedDistanceKm: number | null = null;
  readonly locatingDistance = signal(false);
  readonly distanceError = signal<string | null>(null);

  private appliedLat: number | null = null;
  private appliedLng: number | null = null;

  constructor() {
    super();
    this.loadPeople();
    this.profileService.interests().subscribe({ next: ({ interests }) => this.allInterests.set(interests) });
  }

  private loadPeople(): void {
    this.loading.set(true);
    this.profileService
      .people({
        minAge: this.minAge ?? undefined,
        maxAge: this.maxAge ?? undefined,
        interestIds: this.selectedInterestIds.size ? [...this.selectedInterestIds] : undefined,
        cuisine: this.selectedCuisines.size ? [...this.selectedCuisines] : undefined,
        lat: this.appliedLat ?? undefined,
        lng: this.appliedLng ?? undefined,
        maxDistanceKm: this.selectedDistanceKm ?? undefined,
      })
      .subscribe({
        next: ({ people }) => {
          this.people.set(people);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.minAge !== null || this.maxAge !== null) count++;
    if (this.selectedInterestIds.size) count++;
    if (this.selectedCuisines.size) count++;
    if (this.selectedDistanceKm !== null) count++;
    return count;
  }

  openFilterSheet(): void {
    this.filterSheetOpen.set(true);
  }

  closeFilterSheet(): void {
    this.filterSheetOpen.set(false);
  }

  toggleInterest(id: number): void {
    if (this.selectedInterestIds.has(id)) this.selectedInterestIds.delete(id);
    else this.selectedInterestIds.add(id);
  }

  toggleCuisine(name: string): void {
    if (this.selectedCuisines.has(name)) this.selectedCuisines.delete(name);
    else this.selectedCuisines.add(name);
  }

  selectDistance(km: number): void {
    this.selectedDistanceKm = this.selectedDistanceKm === km ? null : km;
  }

  resetFilters(): void {
    this.minAge = null;
    this.maxAge = null;
    this.selectedInterestIds.clear();
    this.selectedCuisines.clear();
    this.selectedDistanceKm = null;
    this.distanceError.set(null);
  }

  /** A real GPS fix is only requested once a distance filter is actually
   * applied -- no point prompting for location permission just to open the
   * sheet. If it's denied/unavailable, the distance filter is dropped rather
   * than silently returning nobody. */
  async applyFilters(): Promise<void> {
    this.distanceError.set(null);

    if (this.selectedDistanceKm !== null) {
      this.locatingDistance.set(true);
      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
        this.appliedLat = position.coords.latitude;
        this.appliedLng = position.coords.longitude;
      } catch {
        this.appliedLat = null;
        this.appliedLng = null;
        this.selectedDistanceKm = null;
        this.distanceError.set("Couldn't get your location, so the distance filter was skipped.");
      } finally {
        this.locatingDistance.set(false);
      }
    } else {
      this.appliedLat = null;
      this.appliedLng = null;
    }

    this.filterSheetOpen.set(false);
    this.loadPeople();
  }

  message(person: Person): void {
    this.messagingService.getOrCreateWith(person.id).subscribe(({ conversation }) => this.go(`/dining-group-chat/dm/${conversation.id}`));
  }
}
