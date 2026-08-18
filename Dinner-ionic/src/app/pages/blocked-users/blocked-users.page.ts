import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-blocked-users',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blocked-users.page.html',
  styleUrl: './blocked-users.page.scss',
})
export class BlockedUsersPage {
  readonly pageTitle = "Blocked Users";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
