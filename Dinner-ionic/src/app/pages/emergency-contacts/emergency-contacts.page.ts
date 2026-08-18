import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-emergency-contacts',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './emergency-contacts.page.html',
  styleUrl: './emergency-contacts.page.scss',
})
export class EmergencyContactsPage {
  readonly pageTitle = "Emergency Contacts";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
