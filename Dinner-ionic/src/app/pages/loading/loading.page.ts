import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './loading.page.html',
  styleUrl: './loading.page.scss',
})
export class LoadingPage extends BasePage implements OnInit {
  readonly pageTitle = "Loading";
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    // The prototype's loading screen is a transient step; auto-advance
    // after a short delay, same as a real splash/loading flow would --
    // to the admin panel for an admin account (reached here via onboarding
    // after signup), Home for everyone else.
    setTimeout(() => this.go(this.authService.currentUser()?.isAdmin ? '/admin' : '/home'), 1800);
  }
}
