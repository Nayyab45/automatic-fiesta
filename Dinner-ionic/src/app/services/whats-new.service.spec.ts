import { TestBed } from '@angular/core/testing';
import { WhatsNewService } from './whats-new.service';

describe('WhatsNewService', () => {
  let service: WhatsNewService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(WhatsNewService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shouldShow() is true when nothing has been seen yet', () => {
    expect(service.shouldShow()).toBeTrue();
  });

  it('markSeen() records the current version so shouldShow() flips to false', () => {
    service.markSeen();
    expect(service.shouldShow()).toBeFalse();
    expect(localStorage.getItem('whatsNewVersionSeen')).toBe(service.version);
  });

  it('shouldShow() is true again when the seen version does not match the current one', () => {
    localStorage.setItem('whatsNewVersionSeen', 'some-old-version');
    expect(service.shouldShow()).toBeTrue();
  });

  it('shouldShow() returns false (not throw) when localStorage access throws', () => {
    spyOn(localStorage, 'getItem').and.throwError('blocked');
    expect(service.shouldShow()).toBeFalse();
  });

  it('markSeen() does not throw when localStorage access throws', () => {
    spyOn(localStorage, 'setItem').and.throwError('blocked');
    expect(() => service.markSeen()).not.toThrow();
  });
});
