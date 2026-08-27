import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-future-features',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './future-features.page.html',
  styleUrl: './future-features.page.scss',
})
export class FutureFeaturesPage extends BasePage {
  readonly pageTitle = "Future Features";
}
