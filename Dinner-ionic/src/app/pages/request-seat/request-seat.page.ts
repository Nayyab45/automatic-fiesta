import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-request-seat',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './request-seat.page.html',
  styleUrl: './request-seat.page.scss',
})
export class RequestSeatPage extends BasePage {
  readonly pageTitle = "Request Seat";
}
