import { Component, WritableSignal, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { VerificationService } from '../../services/verification.service';
import { resizeImageToDataUrl } from '../../shared/image-resize';

@Component({
  selector: 'app-identity-verification-id-upload',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, HeaderComponent],
  templateUrl: './identity-verification-id-upload.page.html',
  styleUrl: './identity-verification-id-upload.page.scss',
})
export class IdentityVerificationIdUploadPage extends BasePage {
  readonly pageTitle = "Identity Verification - ID Upload";
  private readonly verificationService = inject(VerificationService);

  readonly frontPreview = signal<string | null>(null);
  readonly backPreview = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  onFrontSelected(event: Event): void {
    this.readFile(event, this.frontPreview);
  }

  onBackSelected(event: Event): void {
    this.readFile(event, this.backPreview);
  }

  // Downscales to a small JPEG before it ever becomes a data URL -- a real
  // camera photo straight off a phone (often several MB) otherwise blows
  // past both Express's JSON body limit and identity_verifications' photo
  // columns, and previously did so silently (submit() just reset back to
  // its normal state with no visible error, so tapping Continue looked
  // like it simply did nothing). Same helper profile-creation.page.ts
  // already uses for the same reason.
  private readFile(event: Event, target: WritableSignal<string | null>): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.errorMessage.set(null);
    resizeImageToDataUrl(file)
      .then((dataUrl) => target.set(dataUrl))
      .catch(() => this.errorMessage.set('Could not process that photo. Please try a different one.'));
  }

  submit(): void {
    const front = this.frontPreview();
    const back = this.backPreview();
    if (!front || !back || this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.verificationService.saveId(front, back).subscribe({
      next: () => this.go('/identity-verification-submit-review'),
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Could not save your ID photos. Please try again.');
      },
    });
  }
}
