import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-face-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './face-verification.page.html',
  styleUrl: './face-verification.page.scss',
})
export class FaceVerificationPage extends BasePage {
  readonly pageTitle = "Face Verification";
}
