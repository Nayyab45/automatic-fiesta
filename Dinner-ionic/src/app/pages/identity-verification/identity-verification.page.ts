import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-identity-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './identity-verification.page.html',
  styleUrl: './identity-verification.page.scss',
})
export class IdentityVerificationPage {
  readonly pageTitle = "Identity Verification";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
