import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-safety-checkin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './safety-checkin.page.html',
  styleUrl: './safety-checkin.page.scss',
})
export class SafetyCheckinPage extends BasePage {
  readonly pageTitle = "Safety Check-in";
  checkedIn = false;

  checkIn(): void {
    this.checkedIn = true;
  }

  checkOut(): void {
    if (!this.checkedIn) return;
    this.checkedIn = false;
    this.go('/safety-center');
  }

  callForHelp(): void {
    window.location.href = 'tel:1122';
  }
}
