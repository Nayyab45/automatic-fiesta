import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  @Input() title = 'Are you sure?';
  @Input() message = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() destructive = false;

  @Output() confirm = new EventEmitter<void>();
  // Named `cancelled`, not `cancel`: `cancel` is a standard DOM event name,
  // so an output called that shadows the native event on the host element.
  @Output() cancelled = new EventEmitter<void>();
}
