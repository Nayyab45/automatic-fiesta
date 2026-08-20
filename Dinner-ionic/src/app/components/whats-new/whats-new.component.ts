import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WhatsNewItem, WhatsNewService } from '../../services/whats-new.service';

@Component({
  selector: 'app-whats-new',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './whats-new.component.html',
})
export class WhatsNewComponent {
  @Output() dismiss = new EventEmitter<void>();

  readonly items: WhatsNewItem[];

  constructor(private whatsNew: WhatsNewService) {
    this.items = whatsNew.items;
  }

  close(): void {
    this.whatsNew.markSeen();
    this.dismiss.emit();
  }
}
