import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state-table',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './empty-state-table.page.html',
  styleUrl: './empty-state-table.page.scss',
})
export class EmptyStateTablePage {
  readonly pageTitle = "My Tables (Empty)";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
