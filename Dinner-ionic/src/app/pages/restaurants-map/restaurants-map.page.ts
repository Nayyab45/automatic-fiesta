import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { BasePage } from '../base.page';
import { LocationService } from '../../services/location.service';
import { Restaurant, RestaurantService } from '../../services/restaurant.service';

@Component({
  selector: 'app-restaurants-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './restaurants-map.page.html',
  styleUrl: './restaurants-map.page.scss',
})
export class RestaurantsMapPage extends BasePage implements AfterViewInit, OnDestroy {
  readonly pageTitle = 'Restaurants Map';
  private readonly restaurantService = inject(RestaurantService);
  private readonly zone = inject(NgZone);
  readonly cityService = inject(LocationService);

  readonly loading = signal(true);
  readonly restaurants = signal<Restaurant[]>([]);
  readonly hasCoords = computed(() => this.restaurants().some((r) => r.latitude && r.longitude));

  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLDivElement>;
  private map: L.Map | null = null;

  constructor() {
    super();
    this.restaurantService.list({ city: this.cityService.current() }).subscribe({
      next: ({ restaurants }) => {
        this.restaurants.set(restaurants);
        this.loading.set(false);
        // The map container only exists once *ngIf="!loading()" stops hiding
        // it, which happens on the change-detection pass right after this --
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

  private pin(): L.DivIcon {
    // Same styled marker as restaurant-direction.page.ts, kept in sync so a
    // restaurant looks like the same place on both maps.
    return L.divIcon({
      className: '',
      html: `<div class="w-9 h-9 -translate-x-1/2 -translate-y-full rounded-full rounded-br-none rotate-45 bg-primary border-2 border-white shadow-lg flex items-center justify-center">
               <span class="material-symbols-outlined text-white text-[18px] -rotate-45" style="font-variation-settings: 'FILL' 1;">restaurant</span>
             </div>`,
      iconSize: [36, 36],
      iconAnchor: [0, 0],
    });
  }

  private initMap(): void {
    if (this.map || !this.mapContainer) return;
    const withCoords = this.restaurants().filter((r) => r.latitude && r.longitude);
    if (withCoords.length === 0) return;

    this.map = L.map(this.mapContainer.nativeElement, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    const markers: L.Marker[] = withCoords.map((restaurant) => {
      const marker = L.marker([restaurant.latitude as number, restaurant.longitude as number], {
        icon: this.pin(),
      }).addTo(this.map!);
      marker.bindPopup(this.popupHtml(restaurant));
      marker.on('popupopen', () => this.wirePopupLink(restaurant.id));
      return marker;
    });
    this.map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
  }

  private popupHtml(restaurant: Restaurant): string {
    const ratingText =
      restaurant.rating !== null
        ? `★ ${restaurant.rating} (${restaurant.reviewCount} reviews)`
        : 'Not yet rated';
    return `
      <div style="min-width:180px">
        <p style="font-weight:600;margin-bottom:2px">${restaurant.name}</p>
        <p style="font-size:12px;color:#6b6b6b;margin-bottom:6px">${restaurant.cuisineTags.split(',').join(' · ')} • ${ratingText}</p>
        <button type="button" data-restaurant-id="${restaurant.id}" class="map-popup-view-link" style="color:#8c4e32;font-weight:600;font-size:13px;border:none;background:none;padding:0;cursor:pointer">View Restaurant</button>
      </div>
    `;
  }

  /** Leaflet popups are raw HTML outside Angular's template binding, so the
   * "View Restaurant" button's click needs to be wired up manually once the
   * popup opens, and the resulting navigation run back inside Angular's zone. */
  private wirePopupLink(id: number): void {
    const button = document.querySelector<HTMLButtonElement>(`.map-popup-view-link[data-restaurant-id="${id}"]`);
    button?.addEventListener('click', () => this.zone.run(() => this.go(`/restaurant-detail/${id}`)), { once: true });
  }
}
