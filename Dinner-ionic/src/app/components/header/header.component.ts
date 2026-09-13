import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * The standard top app bar for detail/settings screens: a back button, a
 * centered title (with an optional subtitle line), and an optional single
 * trailing action projected via content.
 *
 * Every detail screen used to hand-roll this bar and the copies had drifted
 * -- sticky vs fixed positioning, different shadow/border treatments,
 * different spacer widths keeping the title centered, arrow_back vs close
 * icons. This is the one shared version.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  @Input() title = '';
  @Input() subtitle?: string | null;
  @Input() showBack = true;
  @Input() backIcon = 'arrow_back';
  @Output() back = new EventEmitter<void>();
}
