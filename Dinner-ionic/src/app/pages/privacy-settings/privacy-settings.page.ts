import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './privacy-settings.page.html',
  styleUrl: './privacy-settings.page.scss',
})
export class PrivacySettingsPage extends BasePage {
  readonly pageTitle = "Privacy Settings";
}
