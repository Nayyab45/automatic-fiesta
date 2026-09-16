import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { VerificationService } from '../../services/verification.service';
import { resizeImageToDataUrl } from '../../shared/image-resize';

@Component({
  selector: 'app-face-verification',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './face-verification.page.html',
  styleUrl: './face-verification.page.scss',
})
export class FaceVerificationPage extends BasePage {
  readonly pageTitle = "Face Verification";
  private readonly verificationService = inject(VerificationService);

  readonly preview = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  onSelfieSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.errorMessage.set(null);
    // See identity-verification-id-upload.page.ts's readFile for why this
    // is resized rather than read as a data URL directly -- a full-res
    // camera selfie otherwise fails to save with no visible error.
    resizeImageToDataUrl(file)
      .then((dataUrl) => this.preview.set(dataUrl))
      .catch(() => this.errorMessage.set('Could not process that photo. Please try a different one.'));
  }

  capture(): void {
    const selfie = this.preview();
    if (!selfie || this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);
    this.verificationService.saveSelfie(selfie).subscribe({
      next: () => this.go('/identity-verification-submit-review'),
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Could not save your selfie. Please try again.');
      },
    });
  }
}
