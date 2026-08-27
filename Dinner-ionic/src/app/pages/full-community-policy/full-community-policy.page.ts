import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-full-community-policy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './full-community-policy.page.html',
  styleUrl: './full-community-policy.page.scss',
})
export class FullCommunityPolicyPage extends BasePage {
  readonly pageTitle = "Full Community Policy";
}
