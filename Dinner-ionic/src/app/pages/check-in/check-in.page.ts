import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-check-in',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './check-in.page.html',
  styleUrl: './check-in.page.scss',
})
export class CheckInPage extends BasePage {
  readonly pageTitle = "Check In";
}
