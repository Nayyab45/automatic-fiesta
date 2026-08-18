import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-help-support',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './help-support.page.html',
  styleUrl: './help-support.page.scss',
})
export class HelpSupportPage {
  readonly pageTitle = "Help & Support";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
