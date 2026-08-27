import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/** The five destinations in the app's primary navigation. */
export type NavTab = 'home' | 'discover' | 'tables' | 'messages' | 'profile';

interface NavItem {
  tab: NavTab;
  label: string;
  icon: string;
  link: string;
}

/**
 * The app's bottom tab bar.
 *
 * This markup used to be copy-pasted into every screen that showed it, and the
 * copies had drifted: 13 pages carried the five-tab bar below, while
 * future-features and identity-verification-id-upload had four-tab variants
 * with different labels *and* different destinations. Those two now use this
 * same bar, so navigation is consistent everywhere.
 *
 * `active` is set explicitly rather than derived from the URL because several
 * screens highlight a tab they are not routed to -- /ai-matching and
 * /search-filter both sit under "Discover", for instance -- which
 * routerLinkActive cannot express.
 */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent {
  /** Which tab renders as current. Omit on screens that highlight none. */
  @Input() active?: NavTab;

  readonly items: readonly NavItem[] = [
    { tab: 'home', label: 'Home', icon: 'home', link: '/home' },
    { tab: 'discover', label: 'Discover', icon: 'explore', link: '/discover-restaurants' },
    { tab: 'tables', label: 'Tables', icon: 'restaurant', link: '/my-tables' },
    { tab: 'messages', label: 'Messages', icon: 'chat_bubble', link: '/messages' },
    { tab: 'profile', label: 'Profile', icon: 'person', link: '/profile' },
  ];
}
