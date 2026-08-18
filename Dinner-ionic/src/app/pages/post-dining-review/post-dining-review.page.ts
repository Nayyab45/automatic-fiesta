import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-post-dining-review',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './post-dining-review.page.html',
  styleUrl: './post-dining-review.page.scss',
})
export class PostDiningReviewPage {
  readonly pageTitle = "Post-Dining Review";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
