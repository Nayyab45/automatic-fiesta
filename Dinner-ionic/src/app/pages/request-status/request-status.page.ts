import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-request-status',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './request-status.page.html',
  styleUrl: './request-status.page.scss',
})
export class RequestStatusPage {
  readonly pageTitle = "Request Status";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
