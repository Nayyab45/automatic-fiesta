import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { PolicyBodyComponent } from '../../components/policy-body/policy-body.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { ContentService } from '../../services/content.service';
import { DEFAULT_PRIVACY_POLICY, PolicyContent } from '../../shared/policy-content';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent, PolicyBodyComponent],
  templateUrl: './privacy-policy.page.html',
  styleUrl: './privacy-policy.page.scss',
})
export class PrivacyPolicyPage extends BasePage {
  readonly pageTitle = "Privacy Policy";
  private readonly contentService = inject(ContentService);

  // Starts on the built-in text so the page is never blank or blocked on the
  // network; an admin's edited version replaces it once it arrives.
  readonly content = signal<PolicyContent>(DEFAULT_PRIVACY_POLICY);

  constructor() {
    super();
    this.contentService.get('privacy-policy').subscribe({
      next: ({ content }) => {
        if (content) this.content.set(content);
      },
      error: () => {},
    });
  }
}
