import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-full-community-policy',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './full-community-policy.page.html',
  styleUrl: './full-community-policy.page.scss',
})
export class FullCommunityPolicyPage extends BasePage {
  readonly pageTitle = "Full Community Policy";
}
