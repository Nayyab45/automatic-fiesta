import { Component, WritableSignal, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { VerificationService } from '../../services/verification.service';

@Component({
  selector: 'app-identity-verification-id-upload',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './identity-verification-id-upload.page.html',
  styleUrl: './identity-verification-id-upload.page.scss',
})
export class IdentityVerificationIdUploadPage extends BasePage {
  readonly pageTitle = "Identity Verification - ID Upload";
  private readonly verificationService = inject(VerificationService);

  readonly frontPreview = signal<string | null>(null);
  readonly backPreview = signal<string | null>(null);
  readonly submitting = signal(false);

  onFrontSelected(event: Event): void {
    this.readFile(event, this.frontPreview);
  }

  onBackSelected(event: Event): void {
    this.readFile(event, this.backPreview);
  }

  private readFile(event: Event, target: WritableSignal<string | null>): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => target.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  submit(): void {
    const front = this.frontPreview();
    const back = this.backPreview();
    if (!front || !back || this.submitting()) return;

    this.submitting.set(true);
    this.verificationService.saveId(front, back).subscribe({
      next: () => this.go('/face-verification'),
      error: () => this.submitting.set(false),
    });
  }
}
