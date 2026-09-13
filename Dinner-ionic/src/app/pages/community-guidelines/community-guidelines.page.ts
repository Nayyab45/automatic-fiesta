import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-community-guidelines',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './community-guidelines.page.html',
  styleUrl: './community-guidelines.page.scss',
})
export class CommunityGuidelinesPage extends BasePage {
  readonly pageTitle = "Community Guidelines";
}
