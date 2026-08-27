import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';
import { BottomNavComponent } from '../../components/bottom-nav/bottom-nav.component';
import { WhatsNewComponent } from '../../components/whats-new/whats-new.component';
import { WhatsNewService } from '../../services/whats-new.service';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, WhatsNewComponent, BottomNavComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage extends BasePage implements OnInit {
  readonly pageTitle = "Home";
  showWhatsNew = false;
  private readonly whatsNew = inject(WhatsNewService);
  readonly cityService = inject(LocationService);

  ngOnInit(): void {
    this.showWhatsNew = this.whatsNew.shouldShow();
  }

  toggleConnect(event: Event): void {
    const btn = event.currentTarget as HTMLElement;
    const icon = btn.querySelector('.material-symbols-outlined');
    if (!icon) return;
    const connected = icon.textContent?.trim() === 'check';
    icon.textContent = connected ? 'add' : 'check';
    btn.classList.toggle('bg-primary/10', !connected);
  }
}
