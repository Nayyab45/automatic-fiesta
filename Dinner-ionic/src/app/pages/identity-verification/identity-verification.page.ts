import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-identity-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './identity-verification.page.html',
  styleUrl: './identity-verification.page.scss',
})
export class IdentityVerificationPage extends BasePage {
  readonly pageTitle = "Identity Verification";
}
