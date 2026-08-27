import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-request-status',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './request-status.page.html',
  styleUrl: './request-status.page.scss',
})
export class RequestStatusPage extends BasePage {
  readonly pageTitle = "Request Status";
  readonly cityService = inject(LocationService);
}
