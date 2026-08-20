import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-identity-verification-submit-review',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './identity-verification-submit-review.page.html',
  styleUrl: './identity-verification-submit-review.page.scss',
})
export class IdentityVerificationSubmitReviewPage {
  readonly pageTitle = "Identity Verification - Review";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
