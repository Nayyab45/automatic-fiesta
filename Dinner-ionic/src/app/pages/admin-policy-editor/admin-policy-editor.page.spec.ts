import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AdminPolicyEditorPage } from './admin-policy-editor.page';
import { ContentService } from '../../services/content.service';
import { DEFAULT_POLICIES } from '../../shared/policy-content';

function fakeRoute(slug: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(slug ? { slug } : {}) },
    paramMap: of(convertToParamMap(slug ? { slug } : {})),
  } as unknown as ActivatedRoute;
}

describe('AdminPolicyEditorPage', () => {
  let contentServiceSpy: jasmine.SpyObj<ContentService>;

  function createComponent(slug: string | null = 'community-guidelines') {
    TestBed.configureTestingModule({
      imports: [AdminPolicyEditorPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(slug) },
        { provide: ContentService, useValue: contentServiceSpy },
      ],
    });
    return TestBed.createComponent(AdminPolicyEditorPage);
  }

  beforeEach(() => {
    contentServiceSpy = jasmine.createSpyObj('ContentService', ['get', 'save', 'reset']);
  });

  it('loads the built-in default text when nothing has been saved yet', () => {
    contentServiceSpy.get.and.returnValue(of({ content: null, updatedAt: null }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.usingDefault()).toBeTrue();
    expect(page.intro).toBe(DEFAULT_POLICIES['community-guidelines'].intro);
    expect(page.sections.length).toBe(DEFAULT_POLICIES['community-guidelines'].sections.length);
    expect(page.loading()).toBeFalse();
  });

  it('loads a previously-saved edit instead of the default', () => {
    const saved = { intro: 'Custom intro', sections: [{ heading: 'Rule 1', body: 'Be kind' }] };
    contentServiceSpy.get.and.returnValue(of({ content: saved, updatedAt: '2026-01-01' }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.usingDefault()).toBeFalse();
    expect(page.intro).toBe('Custom intro');
    expect(page.sections).toEqual([{ heading: 'Rule 1', body: 'Be kind' }]);
  });

  it('falls back to the default text (without crashing) when loading fails', () => {
    contentServiceSpy.get.and.returnValue(throwError(() => new Error('down')));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.usingDefault()).toBeTrue();
    expect(page.loading()).toBeFalse();
  });

  it('does nothing and stops loading for an unknown/unsupported slug', () => {
    const fixture = createComponent('some-other-page');
    expect(contentServiceSpy.get).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  describe('editing sections', () => {
    beforeEach(() => contentServiceSpy.get.and.returnValue(of({ content: null, updatedAt: null })));

    it('addSection() appends a blank section', () => {
      const fixture = createComponent();
      const page = fixture.componentInstance;
      const before = page.sections.length;
      page.addSection();
      expect(page.sections.length).toBe(before + 1);
      expect(page.sections[before]).toEqual({ heading: '', body: '' });
    });

    it('removeSection() removes the section at that index', () => {
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.sections = [{ heading: 'A', body: '' }, { heading: 'B', body: '' }];
      page.removeSection(0);
      expect(page.sections).toEqual([{ heading: 'B', body: '' }]);
    });

    it('move() swaps a section with its neighbor, and does nothing past either end', () => {
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.sections = [{ heading: 'A', body: '' }, { heading: 'B', body: '' }];

      page.move(0, 1);
      expect(page.sections.map((s) => s.heading)).toEqual(['B', 'A']);

      page.move(0, -1);
      expect(page.sections.map((s) => s.heading)).toEqual(['B', 'A']);
    });
  });

  describe('save()', () => {
    beforeEach(() => contentServiceSpy.get.and.returnValue(of({ content: null, updatedAt: null })));

    it('rejects saving with no sections, or a section missing a heading', () => {
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.sections = [];

      page.save();

      expect(contentServiceSpy.save).not.toHaveBeenCalled();
      expect(page.message()?.error).toBeTrue();
    });

    it('saves the intro and sections, and flips usingDefault to false', () => {
      contentServiceSpy.save.and.returnValue(of({ content: { intro: 'x', sections: [] } }));
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.intro = 'New intro';
      page.sections = [{ heading: 'Rule 1', body: 'Be kind', icon: 'star' }];

      page.save();

      expect(contentServiceSpy.save).toHaveBeenCalledWith('community-guidelines', {
        intro: 'New intro',
        sections: [{ heading: 'Rule 1', body: 'Be kind' }],
      });
      expect(page.usingDefault()).toBeFalse();
      expect(page.saving()).toBeFalse();
      expect(page.message()?.error).toBeFalse();
    });

    it('shows the server error message on failure', () => {
      contentServiceSpy.save.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'Section too long' } })));
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.sections = [{ heading: 'Rule 1', body: 'Be kind' }];

      page.save();

      expect(page.saving()).toBeFalse();
      expect(page.message()).toEqual({ text: 'Section too long', error: true });
    });
  });

  describe('resetToDefault()', () => {
    beforeEach(() => contentServiceSpy.get.and.returnValue(of({ content: { intro: 'Custom', sections: [] }, updatedAt: '2026-01-01' })));

    it('does nothing without confirmation', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const fixture = createComponent();

      fixture.componentInstance.resetToDefault();

      expect(contentServiceSpy.reset).not.toHaveBeenCalled();
    });

    it('resets to the built-in text once confirmed', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      contentServiceSpy.reset.and.returnValue(of({}));
      const fixture = createComponent();
      const page = fixture.componentInstance;

      page.resetToDefault();

      expect(contentServiceSpy.reset).toHaveBeenCalledWith('community-guidelines');
      expect(page.usingDefault()).toBeTrue();
      expect(page.intro).toBe(DEFAULT_POLICIES['community-guidelines'].intro);
    });
  });
});
