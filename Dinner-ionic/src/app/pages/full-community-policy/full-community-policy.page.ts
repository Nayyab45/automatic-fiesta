import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-full-community-policy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './full-community-policy.page.html',
  styleUrl: './full-community-policy.page.scss',
})
export class FullCommunityPolicyPage {
  readonly pageTitle = "Full Community Policy";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
