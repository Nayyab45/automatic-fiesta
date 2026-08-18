import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-premium-members',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './premium-members.page.html',
  styleUrl: './premium-members.page.scss',
})
export class PremiumMembersPage {
  readonly pageTitle = "Premium Membership";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
