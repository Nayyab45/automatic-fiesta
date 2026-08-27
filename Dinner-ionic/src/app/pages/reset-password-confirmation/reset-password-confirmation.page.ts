import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-reset-password-confirmation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reset-password-confirmation.page.html',
  styleUrl: './reset-password-confirmation.page.scss',
})
export class ResetPasswordConfirmationPage extends BasePage {
  readonly pageTitle = "Reset Password Sent";
  resent = false;

  resend(): void {
    this.resent = true;
  }

  openEmailApp(): void {
    window.location.href = 'mailto:';
  }
}
