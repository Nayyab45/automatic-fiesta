import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './terms-of-service.page.html',
  styleUrl: './terms-of-service.page.scss',
})
export class TermsOfServicePage extends BasePage {
  readonly pageTitle = "Terms of Service";
}
