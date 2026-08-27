import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-identity-verification-submit-review',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './identity-verification-submit-review.page.html',
  styleUrl: './identity-verification-submit-review.page.scss',
})
export class IdentityVerificationSubmitReviewPage extends BasePage {
  readonly pageTitle = "Identity Verification - Review";
}
