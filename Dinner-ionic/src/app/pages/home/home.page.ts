import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WhatsNewComponent } from '../../components/whats-new/whats-new.component';
import { WhatsNewService } from '../../services/whats-new.service';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, WhatsNewComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit {
  readonly pageTitle = "Home";
  showWhatsNew = false;

  constructor(private router: Router, private location: Location, private whatsNew: WhatsNewService, public cityService: LocationService) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

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
