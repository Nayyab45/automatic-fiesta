import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-guest-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './guest-list.page.html',
  styleUrl: './guest-list.page.scss',
})
export class GuestListPage {
  readonly pageTitle = "Guest List";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
