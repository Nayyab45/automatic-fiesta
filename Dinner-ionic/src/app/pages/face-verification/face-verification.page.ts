import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-face-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './face-verification.page.html',
  styleUrl: './face-verification.page.scss',
})
export class FaceVerificationPage {
  readonly pageTitle = "Face Verification";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
