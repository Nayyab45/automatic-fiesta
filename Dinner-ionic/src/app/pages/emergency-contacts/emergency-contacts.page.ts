import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-emergency-contacts',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './emergency-contacts.page.html',
  styleUrl: './emergency-contacts.page.scss',
})
export class EmergencyContactsPage extends BasePage {
  readonly pageTitle = "Emergency Contacts";
}
