import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { parsePolicyBody } from '../../shared/policy-content';

// Renders the plain-text body format documented in shared/policy-content.ts.
@Component({
  selector: 'app-policy-body',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngFor="let block of blocks(); let first = first">
      <p *ngIf="block.kind === 'p'" [class]="textClass() + (first ? '' : ' mt-stack-sm')">
        <ng-container *ngFor="let s of block.segments"><strong *ngIf="s.bold">{{ s.text }}</strong><ng-container *ngIf="!s.bold">{{ s.text }}</ng-container></ng-container>
      </p>
      <ul *ngIf="block.kind === 'ul'" [class]="'list-disc pl-5 space-y-2 marker:text-primary-container ' + textClass() + (first ? '' : ' mt-stack-sm')">
        <li *ngFor="let item of block.items"><ng-container *ngFor="let s of item"><strong *ngIf="s.bold">{{ s.text }}</strong><ng-container *ngIf="!s.bold">{{ s.text }}</ng-container></ng-container></li>
      </ul>
    </ng-container>
  `,
})
export class PolicyBodyComponent {
  readonly body = input.required<string>();
  readonly textClass = input('text-on-surface-variant');
  readonly blocks = computed(() => parsePolicyBody(this.body()));
}
