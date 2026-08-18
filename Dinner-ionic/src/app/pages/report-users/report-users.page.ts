import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-report-users',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './report-users.page.html',
  styleUrl: './report-users.page.scss',
})
export class ReportUsersPage {
  readonly pageTitle = "Report User";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
