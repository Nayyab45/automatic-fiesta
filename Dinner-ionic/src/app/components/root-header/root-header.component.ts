import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LocationService } from '../../services/location.service';

/**
 * The standard top bar for the app's 5 primary tab screens: a location
 * picker on the left (always navigating to /select-location) and a single
 * trailing action projected via content (settings, notifications, avatar,
 * or a page's own extra controls like Discover's map/search buttons).
 *
 * Home, Discover, Tables, Messages and Profile each hand-rolled this bar
 * with a different look -- a pill background here, an extra chevron there,
 * differently sized trailing icons. This is the one shared version.
 */
@Component({
  selector: 'app-root-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './root-header.component.html',
})
export class RootHeaderComponent {
  @Input() cityLabel = '';
  private readonly router = inject(Router);
  // Reads the *signed-in device user's own* browsing/home city -- never
  // anything about whichever profile a page might otherwise be showing
  // (e.g. someone else's, on profile.page). See LocationService.isTraveling.
  readonly locationService = inject(LocationService);

  openLocationPicker(): void {
    this.router.navigateByUrl('/select-location');
  }
}
