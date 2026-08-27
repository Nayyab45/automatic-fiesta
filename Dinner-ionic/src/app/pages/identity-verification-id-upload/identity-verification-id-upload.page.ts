import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-identity-verification-id-upload',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './identity-verification-id-upload.page.html',
  styleUrl: './identity-verification-id-upload.page.scss',
})
export class IdentityVerificationIdUploadPage extends BasePage {
  readonly pageTitle = "Identity Verification - ID Upload";
}
