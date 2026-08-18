import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './search-filter.page.html',
  styleUrl: './search-filter.page.scss',
})
export class SearchFilterPage {
  readonly pageTitle = "Search & Filter";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
