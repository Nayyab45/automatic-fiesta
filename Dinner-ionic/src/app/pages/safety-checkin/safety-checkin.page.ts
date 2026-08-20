import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-safety-checkin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './safety-checkin.page.html',
  styleUrl: './safety-checkin.page.scss',
})
export class SafetyCheckinPage {
  readonly pageTitle = "Safety Check-in";
  checkedIn = false;

  constructor(private router: Router, private location: Location) {}

  checkIn(): void {
    this.checkedIn = true;
  }

  checkOut(): void {
    if (!this.checkedIn) return;
    this.checkedIn = false;
    this.go('/safety-center');
  }

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  callForHelp(): void {
    window.location.href = 'tel:1122';
  }
}
