import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-personal-interests',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './personal-interests.page.html',
  styleUrl: './personal-interests.page.scss',
})
export class PersonalInterestsPage extends BasePage {
  readonly pageTitle = "Personal Interests";
}
