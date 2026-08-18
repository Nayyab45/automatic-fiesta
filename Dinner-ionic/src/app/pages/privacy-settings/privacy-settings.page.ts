import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './privacy-settings.page.html',
  styleUrl: './privacy-settings.page.scss',
})
export class PrivacySettingsPage {
  readonly pageTitle = "Privacy Settings";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
