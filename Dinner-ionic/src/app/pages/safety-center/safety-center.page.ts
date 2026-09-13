import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';

@Component({
  selector: 'app-safety-center',
  standalone: true,
  imports: [CommonModule, RouterLink, UserAvatarComponent, HeaderComponent],
  templateUrl: './safety-center.page.html',
  styleUrl: './safety-center.page.scss',
})
export class SafetyCenterPage extends BasePage {
  readonly pageTitle = "Safety Center";
}
