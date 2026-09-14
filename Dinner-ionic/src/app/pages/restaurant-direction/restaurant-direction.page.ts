import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { BasePage } from '../base.page';
import { RestaurantDetail, RestaurantService } from '../../services/restaurant.service';

interface OsrmManeuver {
  type: string; // 'depart' | 'turn' | 'continue' | 'roundabout' | 'arrive' | ...
  modifier?: string; // 'left' | 'right' | 'straight' | 'slight left' | 'sharp right' | 'uturn' | ...
  location: [number, number]; // [lng, lat]
}

interface OsrmStep {
  distance: number; // metres to travel on this step
  name: string; // street name, can be empty
  maneuver: OsrmManeuver;
}

interface OsrmRoute {
  distance: number; // metres
  duration: number; // seconds
  geometry: { coordinates: [number, number][] }; // [lng, lat] pairs
  legs: { steps: OsrmStep[] }[];
}

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
  private readonly zone = inject(NgZone);

  readonly restaurant = signal<RestaurantDetail | null>(null);
  readonly loading = signal(true);
  readonly cuisineTags = computed(() => this.restaurant()?.cuisineTags.split(',') ?? []);

  /** Route state: 'locating' -> 'routing' -> 'ready', or 'error' with a
   * user-facing reason (location denied, no route found, etc). The map
   * still shows the restaurant's own pin in every case. */
  readonly routeStatus = signal<'locating' | 'routing' | 'ready' | 'error'>('locating');
  readonly routeError = signal<string | null>(null);
  readonly routeDistanceKm = signal<string | null>(null);
  readonly routeDurationMin = signal<number | null>(null);

  /** Turn-by-turn state, live-updated from the device's real GPS position
   * via Geolocation.watchPosition -- nothing here is simulated or animated. */
  readonly navigating = signal(false);
  readonly currentInstruction = signal<string | null>(null);
  readonly nextStepDistanceM = signal<number | null>(null);
  readonly currentManeuverIcon = signal('navigation');

  private steps: OsrmStep[] = [];
  private currentStepIndex = 0;
  private announcedUpcoming = false;
  private watchId: string | null = null;
  private userMarker: L.Marker | null = null;

  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLDivElement>;
  private map: L.Map | null = null;

  /** ion-router-outlet keeps this page at opacity:0 until it confirms the
   * enter transition finished, which it signals with `ionViewDidEnter` on
   * this host element. Building the Leaflet map (lots of synchronous DOM
   * work for tiles/panes) *before* that fires was starving the transition's
   * own completion detection, so the page stayed invisible forever even
   * though the map itself rendered underneath. Wait for it. The timeout is
   * just a safety net in case this page is ever rendered outside
   * ion-router-outlet (a plain <router-outlet> never dispatches the event
   * at all), so the map still appears rather than never initializing. */
  private viewEntered = false;

  @HostListener('ionViewDidEnter')
  onIonViewDidEnter(): void {
    this.viewEntered = true;
    this.initMap();
  }

  constructor() {
    super();
    setTimeout(() => {
      this.viewEntered = true;
      this.initMap();
    }, 400);

    // Warm up the TTS voice list as early as possible so it's populated by
    // the time the first turn-by-turn announcement needs to speak.
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();

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
    this.stopNavigation();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  private initMap(): void {
    if (this.map || !this.mapContainer || !this.viewEntered) return;
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
    const restaurantMarker = L.marker(position, { icon: pin }).addTo(this.map);

    this.routeToCurrentLocation(restaurant, restaurantMarker);
  }

  /** A small blue dot, matching the marker style every map app uses for
   * "you are here" -- distinct from the restaurant's own primary-colored pin. */
  private userLocationIcon(): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div class="w-4 h-4 rounded-full bg-[#4285F4] border-2 border-white shadow-md"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  /** Locates the user, then draws an actual road route from their current
   * position to the restaurant on this same in-app map -- rather than just
   * handing off to an external maps app, which is all this page used to do. */
  private async routeToCurrentLocation(restaurant: RestaurantDetail, restaurantMarker: L.Marker): Promise<void> {
    if (!this.map || !restaurant.latitude || !restaurant.longitude) return;

    let position: { lat: number; lng: number };
    try {
      const coords = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      position = { lat: coords.coords.latitude, lng: coords.coords.longitude };
    } catch {
      this.zone.run(() => {
        this.routeStatus.set('error');
        this.routeError.set("Couldn't access your location. Enable location access to see the route here.");
      });
      return;
    }

    this.zone.run(() => this.routeStatus.set('routing'));

    this.userMarker = L.marker([position.lat, position.lng], { icon: this.userLocationIcon() }).addTo(this.map);

    // OSRM's public demo routing server: free, no API key, same reasoning as
    // the OpenStreetMap tiles and Nominatim geocoding already used in this
    // app -- see Backend/scripts/geocode-restaurants.mjs. `steps=true` is
    // what gets us the turn-by-turn maneuver list for voice guidance below.
    const url = `https://router.project-osrm.org/route/v1/driving/${position.lng},${position.lat};${restaurant.longitude},${restaurant.latitude}?overview=full&geometries=geojson&steps=true`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM responded ${response.status}`);
      const data = await response.json();
      const route: OsrmRoute | undefined = data.routes?.[0];
      if (!route) throw new Error('No route in OSRM response');

      const routeLatLngs: L.LatLngExpression[] = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const routeLine = L.polyline(routeLatLngs, { color: '#735b25', weight: 5, opacity: 0.85 }).addTo(this.map);
      this.map.fitBounds(L.featureGroup([restaurantMarker, this.userMarker, routeLine]).getBounds().pad(0.15));

      this.zone.run(() => {
        this.routeStatus.set('ready');
        this.routeDistanceKm.set((route.distance / 1000).toFixed(1));
        this.routeDurationMin.set(Math.round(route.duration / 60));
      });

      this.zone.run(() => this.startTurnByTurnNavigation(route));
    } catch {
      this.map.fitBounds(L.featureGroup([restaurantMarker, this.userMarker]).getBounds().pad(0.3));
      this.zone.run(() => {
        this.routeStatus.set('error');
        this.routeError.set("Couldn't calculate a route right now. You can still get directions in your maps app below.");
      });
    }
  }

  /** Turns "maneuver.type + maneuver.modifier + street name" from OSRM into
   * the kind of sentence a voice-guidance system reads aloud. */
  private instructionText(step: OsrmStep): string {
    const { type, modifier } = step.maneuver;
    const onStreet = step.name ? ` onto ${step.name}` : '';
    if (type === 'arrive') return 'You have arrived at your destination';
    if (type === 'depart') return `Head ${modifier ?? 'out'}${step.name ? ` on ${step.name}` : ''}`;
    if (type === 'roundabout' || type === 'rotary') return `Enter the roundabout${onStreet}`;
    if (modifier === 'uturn') return `Make a U-turn${onStreet}`;
    if (modifier?.includes('left')) return `Turn left${onStreet}`;
    if (modifier?.includes('right')) return `Turn right${onStreet}`;
    if (modifier === 'straight') return `Continue straight${onStreet}`;
    return `Continue${onStreet}`;
  }

  private maneuverIcon(step: OsrmStep): string {
    if (step.maneuver.type === 'arrive') return 'flag';
    const m = step.maneuver.modifier;
    if (m === 'uturn') return 'u_turn_left';
    if (m?.includes('sharp left')) return 'turn_sharp_left';
    if (m?.includes('sharp right')) return 'turn_sharp_right';
    if (m?.includes('left')) return 'turn_left';
    if (m?.includes('right')) return 'turn_right';
    return 'straight';
  }

  private speak(text: string): void {
    console.log('[nav-debug] speak() called with:', text, 'has speechSynthesis=', 'speechSynthesis' in window);
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    console.log('[nav-debug] voices available:', synth.getVoices().length, 'speaking=', synth.speaking, 'pending=', synth.pending);
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.volume = 1;
    utterance.onstart = () => console.log('[nav-debug] utterance started');
    utterance.onerror = (e) => console.log('[nav-debug] utterance error', e.error);
    utterance.onend = () => console.log('[nav-debug] utterance ended');
    // Android WebViews often start with an empty voice list -- speaking
    // before it loads silently drops the utterance, no error thrown. Retry
    // once the list is populated if that's the state we're in.
    if (synth.getVoices().length === 0) {
      console.log('[nav-debug] no voices yet, waiting for voiceschanged');
      synth.addEventListener('voiceschanged', () => synth.speak(utterance), { once: true });
    } else {
      synth.speak(utterance);
    }
  }

  private distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** Starts real turn-by-turn guidance: watches the device's actual GPS
   * position (no simulation) and, as the user physically moves, updates the
   * live position on the map and speaks each maneuver as they approach and
   * reach it, using OSRM's real step-by-step route data. */
  private async startTurnByTurnNavigation(route: OsrmRoute): Promise<void> {
    this.steps = route.legs?.[0]?.steps ?? [];
    console.log('[nav-debug] startTurnByTurnNavigation, steps=', this.steps.length, 'map=', !!this.map);
    if (this.steps.length === 0 || !this.map) return;

    this.currentStepIndex = 0;
    this.announcedUpcoming = false;
    this.navigating.set(true);
    console.log('[nav-debug] navigating set to', this.navigating());
    this.currentManeuverIcon.set(this.maneuverIcon(this.steps[0]));
    this.announceStep(this.steps[0]);

    try {
      this.watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 10000 }, (position, err) => {
        console.log('[nav-debug] watchPosition callback fired, err=', err, 'position=', !!position);
        if (err || !position) return;
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
        this.zone.run(() => this.onPositionUpdate(here));
      });
      console.log('[nav-debug] watchPosition started, id=', this.watchId);
    } catch (e) {
      console.log('[nav-debug] watchPosition threw', e);
    }
  }

  private announceStep(step: OsrmStep): void {
    const text = this.instructionText(step);
    this.currentInstruction.set(text);
    this.speak(text);
  }

  private onPositionUpdate(here: { lat: number; lng: number }): void {
    if (!this.map || !this.userMarker) return;
    this.userMarker.setLatLng([here.lat, here.lng]);
    this.map.setView([here.lat, here.lng], Math.max(this.map.getZoom(), 17), { animate: true });

    const step = this.steps[this.currentStepIndex];
    if (!step) return;

    const target = { lat: step.maneuver.location[1], lng: step.maneuver.location[0] };
    const distance = this.distanceMeters(here, target);
    const isFinalStep = this.currentStepIndex === this.steps.length - 1;

    this.nextStepDistanceM.set(Math.round(distance));
    this.currentManeuverIcon.set(this.maneuverIcon(step));

    if (!isFinalStep && distance < 150 && !this.announcedUpcoming) {
      this.speak(`In ${Math.round(distance / 10) * 10} meters, ${this.instructionText(step)}`);
      this.announcedUpcoming = true;
    }

    if (distance < (isFinalStep ? 25 : 30)) {
      if (isFinalStep) {
        this.currentInstruction.set('You have arrived at your destination');
        this.speak('You have arrived at your destination');
        this.stopNavigation();
        return;
      }
      this.currentStepIndex++;
      this.announcedUpcoming = false;
      const nextStep = this.steps[this.currentStepIndex];
      if (nextStep) this.announceStep(nextStep);
    } else {
      this.currentInstruction.set(this.instructionText(step));
    }
  }

  private stopNavigation(): void {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
    this.navigating.set(false);
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
