import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';
import { FeaturedDish, Restaurant, RestaurantService } from '../../services/restaurant.service';
import { Person, ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-explore-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './explore-menu.page.html',
  styleUrl: './explore-menu.page.scss',
})
export class ExploreMenuPage extends BasePage {
  readonly pageTitle = 'Explore Menu';
  readonly cityService = inject(LocationService);
  private readonly restaurantService = inject(RestaurantService);
  private readonly profileService = inject(ProfileService);

  readonly featuredDishes = signal<FeaturedDish[]>([]);
  readonly topRatedRestaurants = signal<Restaurant[]>([]);
  readonly peopleToMeet = signal<Person[]>([]);

  constructor() {
    super();
    this.restaurantService.featuredDishes().subscribe(({ dishes }) => this.featuredDishes.set(dishes));
    this.restaurantService.list().subscribe(({ restaurants }) => this.topRatedRestaurants.set(restaurants.slice(0, 5)));
    this.profileService.people().subscribe(({ people }) => this.peopleToMeet.set(people.slice(0, 5)));
  }

  toggleChip(event: Event): void {
    (event.currentTarget as HTMLElement).classList.toggle('chip-selected');
  }
}
