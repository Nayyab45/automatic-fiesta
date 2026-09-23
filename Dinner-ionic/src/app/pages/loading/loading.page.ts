import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './loading.page.html',
  styleUrl: './loading.page.scss',
})
export class LoadingPage extends BasePage implements OnInit {
  readonly pageTitle = "Loading";

  ngOnInit(): void {
    // The prototype's loading screen is a transient step; auto-advance
    // after a short delay, same as a real splash/loading flow would.
    setTimeout(() => this.go('/home'), 1800);
  }
}
