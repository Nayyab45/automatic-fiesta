import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-post-dining-review',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './post-dining-review.page.html',
  styleUrl: './post-dining-review.page.scss',
})
export class PostDiningReviewPage extends BasePage {
  readonly pageTitle = "Post-Dining Review";
}
