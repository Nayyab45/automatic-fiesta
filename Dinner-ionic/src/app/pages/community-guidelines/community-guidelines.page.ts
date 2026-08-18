import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-community-guidelines',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './community-guidelines.page.html',
  styleUrl: './community-guidelines.page.scss',
})
export class CommunityGuidelinesPage {
  readonly pageTitle = "Community Guidelines";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
