import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { BasePage } from '../base.page';
import { ContentService } from '../../services/content.service';
import { DEFAULT_POLICIES, POLICY_TITLES, PolicySection, PolicySlug, isPolicySlug } from '../../shared/policy-content';

@Component({
  selector: 'app-admin-policy-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './admin-policy-editor.page.html',
  styleUrl: './admin-policy-editor.page.scss',
})
export class AdminPolicyEditorPage extends BasePage {
  readonly pageTitle = 'Edit Policy';
  private readonly contentService = inject(ContentService);

  readonly slug = signal<PolicySlug | null>(null);
  readonly title = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly message = signal<{ text: string; error: boolean } | null>(null);
  /** True while the form still shows the built-in text (nothing saved yet). */
  readonly usingDefault = signal(true);

  intro = '';
  sections: PolicySection[] = [];

  constructor() {
    super();
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!isPolicySlug(slug)) {
        this.loading.set(false);
        return;
      }
      this.slug.set(slug);
      this.title.set(POLICY_TITLES[slug]);
      this.load(slug);
    });
  }

  private load(slug: PolicySlug): void {
    this.loading.set(true);
    this.contentService.get(slug).subscribe({
      next: ({ content }) => {
        this.usingDefault.set(!content);
        this.fill(content ?? DEFAULT_POLICIES[slug]);
        this.loading.set(false);
      },
      error: () => {
        this.usingDefault.set(true);
        this.fill(DEFAULT_POLICIES[slug]);
        this.loading.set(false);
      },
    });
  }

  private fill(content: { intro: string; sections: PolicySection[] }): void {
    this.intro = content.intro;
    // Copied so editing never mutates the shared built-in defaults.
    this.sections = content.sections.map((s) => ({ ...s }));
  }

  addSection(): void {
    this.sections.push({ heading: '', body: '' });
  }

  removeSection(index: number): void {
    this.sections.splice(index, 1);
  }

  move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= this.sections.length) return;
    [this.sections[index], this.sections[target]] = [this.sections[target], this.sections[index]];
  }

  save(): void {
    const slug = this.slug();
    if (!slug || this.saving()) return;
    if (this.sections.length === 0 || this.sections.some((s) => !s.heading.trim())) {
      this.message.set({ text: 'Add at least one section, and give every section a heading.', error: true });
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    this.contentService
      .save(slug, { intro: this.intro, sections: this.sections.map(({ heading, body }) => ({ heading, body })) })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.usingDefault.set(false);
          this.message.set({ text: 'Saved. The app now shows this version.', error: false });
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.message.set({ text: err.error?.message ?? "Couldn't save. Try again.", error: true });
        },
      });
  }

  resetToDefault(): void {
    const slug = this.slug();
    if (!slug || this.saving()) return;
    if (!confirm('Discard your edits and go back to the original text?')) return;
    this.saving.set(true);
    this.message.set(null);
    this.contentService.reset(slug).subscribe({
      next: () => {
        this.saving.set(false);
        this.usingDefault.set(true);
        this.fill(DEFAULT_POLICIES[slug]);
        this.message.set({ text: 'Reset to the original text.', error: false });
      },
      error: () => {
        this.saving.set(false);
        this.message.set({ text: "Couldn't reset. Try again.", error: true });
      },
    });
  }
}
