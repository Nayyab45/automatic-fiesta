import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-safety-center',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './safety-center.page.html',
  styleUrl: './safety-center.page.scss',
})
export class SafetyCenterPage {
  readonly pageTitle = "Safety Center";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
