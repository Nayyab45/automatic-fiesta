import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-identity-verification-id-upload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './identity-verification-id-upload.page.html',
  styleUrl: './identity-verification-id-upload.page.scss',
})
export class IdentityVerificationIdUploadPage {
  readonly pageTitle = "Identity Verification - ID Upload";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
