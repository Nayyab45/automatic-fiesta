import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-restaurant-direction',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-direction.page.html',
  styleUrl: './restaurant-direction.page.scss',
})
export class RestaurantDirectionPage {
  readonly pageTitle = "Restaurant Direction";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
