import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './splash.page.html',
  styleUrl: './splash.page.scss',
})
export class SplashPage extends BasePage {
  readonly pageTitle = "Splash";
}
