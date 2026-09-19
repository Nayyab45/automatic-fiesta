import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../components/header/header.component';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { BasePage } from '../base.page';
import { FeaturedDish, RestaurantService } from '../../services/restaurant.service';

@Component({
  selector: 'app-all-dishes',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, BottomNavComponent],
  templateUrl: './all-dishes.page.html',
  styleUrl: './all-dishes.page.scss',
})
export class AllDishesPage extends BasePage {
  readonly pageTitle = 'All Dishes';
  private readonly restaurantService = inject(RestaurantService);

  private readonly allDishes = signal<FeaturedDish[]>([]);
  readonly query = signal('');
  readonly loading = signal(true);
  readonly failed = signal(false);

  readonly dishes = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.allDishes();
    return this.allDishes().filter((d) => [d.name, d.restaurantName, d.description ?? ''].some((v) => v.toLowerCase().includes(q)));
  });

  constructor() {
    super();
    this.restaurantService.allDishes().subscribe({
      next: ({ dishes }) => {
        this.allDishes.set(dishes);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}
