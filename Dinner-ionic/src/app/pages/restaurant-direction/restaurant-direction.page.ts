import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { BasePage } from '../base.page';
import { RestaurantDetail, RestaurantService } from '../../services/restaurant.service';

@Component({
  selector: 'app-restaurant-direction',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-direction.page.html',
  styleUrl: './restaurant-direction.page.scss',
})
export class RestaurantDirectionPage extends BasePage implements AfterViewInit, OnDestroy {
  readonly pageTitle = "Restaurant Direction";
  private readonly restaurantService = inject(RestaurantService);

  readonly restaurant = signal<RestaurantDetail | null>(null);
  readonly loading = signal(true);
  readonly cuisineTags = computed(() => this.restaurant()?.cuisineTags.split(',') ?? []);

  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLDivElement>;
  private map: L.Map | null = null;

  constructor() {
    super();
    const id = this.routeId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.restaurantService.get(id).subscribe({
      next: ({ restaurant }) => {
        this.restaurant.set(restaurant);
        this.loading.set(false);
        // The map container only exists once *ngIf="!loading()" renders it,
        // which happens on the change-detection pass right after this --
        // defer to let that happen before touching the DOM node.
        setTimeout(() => this.initMap());
      },
      error: () => this.loading.set(false),
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    if (this.map || !this.mapContainer) return;
    const restaurant = this.restaurant();
    if (!restaurant?.latitude || !restaurant?.longitude) return;

    const position: L.LatLngExpression = [restaurant.latitude, restaurant.longitude];
    this.map = L.map(this.mapContainer.nativeElement, {
      center: position,
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    // OpenStreetMap tiles: free, no API key, unlike Google Maps' billed tile
    // API -- the same reasoning as Nominatim for geocoding (see
    // Backend/scripts/geocode-restaurants.mjs).
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    // A styled div icon instead of Leaflet's default marker images -- those
    // ship as separate PNG files whose relative paths don't resolve
    // correctly once bundled, a well-known Leaflet+Angular integration
    // snag. This also matches the app's own visual language instead of
    // Leaflet's stock blue pin.
    const pin = L.divIcon({
      className: '',
      html: `<div class="w-9 h-9 -translate-x-1/2 -translate-y-full rounded-full rounded-br-none rotate-45 bg-primary border-2 border-white shadow-lg flex items-center justify-center">
               <span class="material-symbols-outlined text-white text-[18px] -rotate-45" style="font-variation-settings: 'FILL' 1;">restaurant</span>
             </div>`,
      iconSize: [36, 36],
      iconAnchor: [0, 0],
    });
    L.marker(position, { icon: pin }).addTo(this.map);
  }

  /** Google Maps' universal deep-link format -- opens the native Maps app
   * if installed (Android/iOS both handle it as an app link), falls back to
   * maps.google.com in a browser otherwise. No API key needed since this is
   * just a URL, not a Maps SDK call. */
  directionsUrl(restaurant: RestaurantDetail): string {
    if (restaurant.latitude && restaurant.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address || restaurant.name)}`;
  }
}
