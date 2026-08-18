import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-personal-interests',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './personal-interests.page.html',
  styleUrl: './personal-interests.page.scss',
})
export class PersonalInterestsPage {
  readonly pageTitle = "Personal Interests";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
