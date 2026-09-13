import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { VerificationService } from '../../services/verification.service';

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

  onSelfieSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.preview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  capture(): void {
    const selfie = this.preview();
    if (!selfie || this.saving()) return;

    this.saving.set(true);
    this.verificationService.saveSelfie(selfie).subscribe({
      next: () => this.go('/identity-verification-submit-review'),
      error: () => this.saving.set(false),
    });
  }
}
