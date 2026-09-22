import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminSupportPage } from './admin-support.page';
import { SupportMessage, SupportService } from '../../services/support.service';

const MESSAGE: SupportMessage = {
  id: 1,
  name: 'Sam',
  email: 'sam@example.com',
  subject: 'Bug report',
  message: 'The app crashed',
  status: 'open',
  createdAt: new Date().toISOString(),
};

describe('AdminSupportPage', () => {
  let supportServiceSpy: jasmine.SpyObj<SupportService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AdminSupportPage],
      providers: [provideRouter([]), { provide: SupportService, useValue: supportServiceSpy }],
    });
    return TestBed.createComponent(AdminSupportPage);
  }

  beforeEach(() => {
    supportServiceSpy = jasmine.createSpyObj('SupportService', ['list', 'resolve']);
  });

  it('loads the support message queue', () => {
    supportServiceSpy.list.and.returnValue(of({ messages: [MESSAGE] }));
    const fixture = createComponent();
    expect(fixture.componentInstance.messages()).toEqual([MESSAGE]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('marks the page forbidden on a 403', () => {
    supportServiceSpy.list.and.returnValue(throwError(() => ({ status: 403 })));
    const fixture = createComponent();
    expect(fixture.componentInstance.forbidden()).toBeTrue();
  });

  it('resolve() flips the message status in place rather than removing it', () => {
    supportServiceSpy.list.and.returnValue(of({ messages: [MESSAGE] }));
    supportServiceSpy.resolve.and.returnValue(of({}));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.resolve(MESSAGE);

    expect(supportServiceSpy.resolve).toHaveBeenCalledWith(1);
    expect(page.messages()[0].status).toBe('resolved');
    expect(page.resolvingId()).toBeNull();
  });

  it('resolve() ignores a second call while one is already in flight', () => {
    supportServiceSpy.list.and.returnValue(of({ messages: [MESSAGE] }));
    supportServiceSpy.resolve.and.returnValue(of({}));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.resolvingId.set(1);
    page.resolve(MESSAGE);

    expect(supportServiceSpy.resolve).not.toHaveBeenCalled();
  });
});
