import { AfterViewInit, Directive, DoCheck, ElementRef, HostListener, inject } from '@angular/core';

// Grows a textarea to fit its text so it never scrolls on its own. In a long
// form, a textarea with its own scrollbar swallows touch drags on a phone --
// the page then feels stuck, because most of the screen is textareas.
@Directive({
  selector: 'textarea[appAutosize]',
  standalone: true,
})
export class AutosizeDirective implements AfterViewInit, DoCheck {
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;
  private lastValue: string | null = null;

  ngAfterViewInit(): void {
    this.el.style.overflowY = 'hidden';
    this.el.style.resize = 'none';
    this.resize();
  }

  // ngModel writes its value after the view is created, and edits can come
  // from code (add/remove/reorder sections) -- so re-measure whenever the
  // value differs from the last measurement, not only on typing.
  ngDoCheck(): void {
    if (this.el.value !== this.lastValue) this.resize();
  }

  @HostListener('input')
  resize(): void {
    this.lastValue = this.el.value;
    this.el.style.height = 'auto';
    // border-box sizing: scrollHeight excludes the border, so add it back or
    // the box ends up a couple of pixels short and still scrolls.
    const border = this.el.offsetHeight - this.el.clientHeight;
    this.el.style.height = `${this.el.scrollHeight + border}px`;
  }
}
