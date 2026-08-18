import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-edit-preferences',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './edit-preferences.page.html',
  styleUrl: './edit-preferences.page.scss',
})
export class EditPreferencesPage {
  readonly pageTitle = "Edit Preferences";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
