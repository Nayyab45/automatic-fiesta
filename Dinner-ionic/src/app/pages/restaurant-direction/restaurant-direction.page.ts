import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-restaurant-direction',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-direction.page.html',
  styleUrl: './restaurant-direction.page.scss',
})
export class RestaurantDirectionPage extends BasePage {
  readonly pageTitle = "Restaurant Direction";
}
