import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-ai-matching',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './ai-matching.page.html',
  styleUrl: './ai-matching.page.scss',
})
export class AiMatchingPage extends BasePage {
  readonly pageTitle = "AI Matching";
  readonly cityService = inject(LocationService);
}
