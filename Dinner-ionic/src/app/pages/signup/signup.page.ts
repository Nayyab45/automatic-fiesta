import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './signup.page.html',
  styleUrl: './signup.page.scss',
})
export class SignupPage extends BasePage {
  readonly pageTitle = "Sign Up";
}
