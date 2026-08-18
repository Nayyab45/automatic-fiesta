import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-discover-people',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './discover-people.page.html',
  styleUrl: './discover-people.page.scss',
})
export class DiscoverPeoplePage {
  readonly pageTitle = "Discover People";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
