import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './messages.page.html',
  styleUrl: './messages.page.scss',
})
export class MessagesPage extends BasePage {
  readonly pageTitle = "Messages";
  readonly cityService = inject(LocationService);
}
