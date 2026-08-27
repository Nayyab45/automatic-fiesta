import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-report-users',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './report-users.page.html',
  styleUrl: './report-users.page.scss',
})
export class ReportUsersPage extends BasePage {
  readonly pageTitle = "Report User";
}
