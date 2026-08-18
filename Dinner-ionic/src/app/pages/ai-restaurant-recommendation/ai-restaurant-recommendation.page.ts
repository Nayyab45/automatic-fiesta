import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-ai-restaurant-recommendation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ai-restaurant-recommendation.page.html',
  styleUrl: './ai-restaurant-recommendation.page.scss',
})
export class AiRestaurantRecommendationPage {
  readonly pageTitle = "AI Recommendation";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
