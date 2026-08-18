import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-ai-matching',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ai-matching.page.html',
  styleUrl: './ai-matching.page.scss',
})
export class AiMatchingPage {
  readonly pageTitle = "AI Matching";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
