import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './loading.page.html',
  styleUrl: './loading.page.scss',
})
export class LoadingPage implements OnInit {
  readonly pageTitle = "Loading";


  constructor(private router: Router, private location: Location) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    // The prototype's loading screen is a transient step; auto-advance to
    // Home after a short delay, same as a real splash/loading flow would.
    setTimeout(() => this.go('/home'), 1800);
  }
}
