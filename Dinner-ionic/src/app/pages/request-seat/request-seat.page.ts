import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-request-seat',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './request-seat.page.html',
  styleUrl: './request-seat.page.scss',
})
export class RequestSeatPage {
  readonly pageTitle = "Request Seat";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
