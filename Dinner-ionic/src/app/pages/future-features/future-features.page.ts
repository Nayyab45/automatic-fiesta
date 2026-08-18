import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-future-features',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './future-features.page.html',
  styleUrl: './future-features.page.scss',
})
export class FutureFeaturesPage {
  readonly pageTitle = "Future Features";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
