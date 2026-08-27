import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

@Component({
  selector: 'app-safety-center',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './safety-center.page.html',
  styleUrl: './safety-center.page.scss',
})
export class SafetyCenterPage extends BasePage {
  readonly pageTitle = "Safety Center";
}
