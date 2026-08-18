import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-check-in',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './check-in.page.html',
  styleUrl: './check-in.page.scss',
})
export class CheckInPage {
  readonly pageTitle = "Check In";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
