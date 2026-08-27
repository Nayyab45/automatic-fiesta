import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-ai-restaurant-recommendation',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './ai-restaurant-recommendation.page.html',
  styleUrl: './ai-restaurant-recommendation.page.scss',
})
export class AiRestaurantRecommendationPage extends BasePage {
  readonly pageTitle = "AI Recommendation";
  readonly cityService = inject(LocationService);
}
