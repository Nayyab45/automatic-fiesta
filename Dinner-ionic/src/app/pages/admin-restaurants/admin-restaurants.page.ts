import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { AdminRestaurant, AdminRestaurantPayload, AdminService } from '../../services/admin.service';
import { RestaurantService } from '../../services/restaurant.service';

interface RestaurantForm {
  name: string;
  city: string;
  region: string;
  cuisineTags: string;
  priceTier: number | null;
  address: string;
  description: string;
  photoUrl: string;
  latitude: number | null;
  longitude: number | null;
  contactPhone: string;
  contactEmail: string;
  website: string;
}

const EMPTY_FORM: RestaurantForm = {
  name: '',
  city: '',
  region: '',
  cuisineTags: '',
  priceTier: null,
  address: '',
  description: '',
  photoUrl: '',
  latitude: null,
  longitude: null,
  contactPhone: '',
  contactEmail: '',
  website: '',
};

@Component({
  selector: 'app-admin-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './admin-restaurants.page.html',
  styleUrl: './admin-restaurants.page.scss',
})
export class AdminRestaurantsPage extends BasePage {
  readonly pageTitle = 'Restaurant Management';
  private readonly adminService = inject(AdminService);
  private readonly restaurantService = inject(RestaurantService);

  readonly restaurants = signal<AdminRestaurant[]>([]);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly listError = signal<string | null>(null);
  /** null = adding a new restaurant, otherwise editing this id. */
  readonly editingId = signal<number | null>(null);
  search = '';
  form: RestaurantForm = { ...EMPTY_FORM };

  constructor() {
    super();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.adminService.restaurants(this.search.trim()).subscribe({
      next: ({ restaurants }) => {
        this.restaurants.set(restaurants);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.forbidden.set(err.status === 403);
        this.loading.set(false);
      },
    });
  }

  openAdd(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.formError.set(null);
    this.formOpen.set(true);
  }

  // The list rows are a trimmed summary; the full record (description,
  // photo, coordinates, contact details) comes from the public detail
  // endpoint so the form starts out complete rather than blanking fields.
  openEdit(row: AdminRestaurant): void {
    this.editingId.set(row.id);
    this.formError.set(null);
    this.restaurantService.get(row.id).subscribe({
      next: ({ restaurant }) => {
        this.form = {
          name: restaurant.name,
          city: restaurant.city,
          region: restaurant.region,
          cuisineTags: restaurant.cuisineTags,
          priceTier: restaurant.priceTier,
          address: restaurant.address ?? '',
          description: restaurant.description ?? '',
          photoUrl: restaurant.photoUrl ?? '',
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          contactPhone: restaurant.contactPhone ?? '',
          contactEmail: restaurant.contactEmail ?? '',
          // Not on the public Restaurant type (the app never shows it) --
          // it's still returned by the API, so a save doesn't wipe it.
          website: (restaurant as { website?: string | null }).website ?? '',
        };
        this.formOpen.set(true);
      },
      error: () => this.listError.set("Couldn't load that restaurant."),
    });
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  save(): void {
    if (this.saving()) return;
    if (!this.form.name.trim() || !this.form.city.trim() || !this.form.cuisineTags.trim()) {
      this.formError.set('Name, city and cuisine tags are required.');
      return;
    }
    const payload: AdminRestaurantPayload = {
      ...this.form,
      latitude: this.form.latitude === null || (this.form.latitude as unknown) === '' ? null : Number(this.form.latitude),
      longitude: this.form.longitude === null || (this.form.longitude as unknown) === '' ? null : Number(this.form.longitude),
      priceTier: this.form.priceTier === null || (this.form.priceTier as unknown) === '' ? null : Number(this.form.priceTier),
    };
    const id = this.editingId();
    this.saving.set(true);
    this.formError.set(null);
    (id === null ? this.adminService.createRestaurant(payload) : this.adminService.updateRestaurant(id, payload)).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message ?? "Couldn't save the restaurant.");
      },
    });
  }

  remove(row: AdminRestaurant): void {
    if (!confirm(`Delete ${row.name}? Its dishes, reviews and saves are removed too.`)) return;
    this.listError.set(null);
    this.adminService.deleteRestaurant(row.id).subscribe({
      next: () => this.restaurants.update((list) => list.filter((r) => r.id !== row.id)),
      error: (err: HttpErrorResponse) => this.listError.set(err.error?.message ?? "Couldn't delete that restaurant."),
    });
  }
}
