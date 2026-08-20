import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-reset-password-confirmation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reset-password-confirmation.page.html',
  styleUrl: './reset-password-confirmation.page.scss',
})
export class ResetPasswordConfirmationPage {
  readonly pageTitle = "Reset Password Sent";
  resent = false;

  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  resend(): void {
    this.resent = true;
  }

  openEmailApp(): void {
    window.location.href = 'mailto:';
  }
}
