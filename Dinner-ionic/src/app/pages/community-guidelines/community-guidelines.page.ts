import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { PolicyBodyComponent } from '../../components/policy-body/policy-body.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { ContentService } from '../../services/content.service';
import { DEFAULT_COMMUNITY_GUIDELINES, PolicyContent, iconForSection } from '../../shared/policy-content';

@Component({
  selector: 'app-community-guidelines',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent, PolicyBodyComponent],
  templateUrl: './community-guidelines.page.html',
  styleUrl: './community-guidelines.page.scss',
})
export class CommunityGuidelinesPage extends BasePage {
  readonly pageTitle = "Community Guidelines";
  private readonly contentService = inject(ContentService);

  readonly content = signal<PolicyContent>(DEFAULT_COMMUNITY_GUIDELINES);
  readonly iconForSection = iconForSection;

  constructor() {
    super();
    this.contentService.get('community-guidelines').subscribe({
      next: ({ content }) => {
        if (content) this.content.set(content);
      },
      error: () => {},
    });
  }

  isWarning(heading: string): boolean {
    return /zero tolerance/i.test(heading);
  }
}
