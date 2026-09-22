import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AdminModerationPage } from './admin-moderation.page';
import { FlaggedUser, ModerationService } from '../../services/moderation.service';
import { AdminService } from '../../services/admin.service';

const FLAGGED_USER: FlaggedUser = { userId: 1, name: 'Sam', email: 'sam@example.com', flaggedAt: new Date().toISOString(), blockCount: 3, reportCount: 1 };

describe('AdminModerationPage', () => {
  let moderationServiceSpy: jasmine.SpyObj<ModerationService>;
  let adminServiceSpy: jasmine.SpyObj<AdminService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AdminModerationPage],
      providers: [
        provideRouter([]),
        { provide: ModerationService, useValue: moderationServiceSpy },
        { provide: AdminService, useValue: adminServiceSpy },
      ],
    });
    return TestBed.createComponent(AdminModerationPage);
  }

  beforeEach(() => {
    moderationServiceSpy = jasmine.createSpyObj('ModerationService', ['flagged', 'dismiss', 'deleteAccount']);
    adminServiceSpy = jasmine.createSpyObj('AdminService', ['suspend']);
  });

  it('loads the flagged-user queue', () => {
    moderationServiceSpy.flagged.and.returnValue(of({ flagged: [FLAGGED_USER] }));
    const fixture = createComponent();
    expect(fixture.componentInstance.flagged()).toEqual([FLAGGED_USER]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('marks the page forbidden on a 403, distinct from an empty queue', () => {
    moderationServiceSpy.flagged.and.returnValue(throwError(() => ({ status: 403 })));
    const fixture = createComponent();
    expect(fixture.componentInstance.forbidden()).toBeTrue();
  });

  it('dismiss() removes the user from the queue on success', () => {
    moderationServiceSpy.flagged.and.returnValue(of({ flagged: [FLAGGED_USER] }));
    moderationServiceSpy.dismiss.and.returnValue(of({}));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.dismiss(FLAGGED_USER);

    expect(moderationServiceSpy.dismiss).toHaveBeenCalledWith(1);
    expect(page.flagged()).toEqual([]);
    expect(page.actingOnUserId()).toBeNull();
  });

  it('dismiss() ignores a second call while one is already in flight', () => {
    moderationServiceSpy.flagged.and.returnValue(of({ flagged: [FLAGGED_USER] }));
    moderationServiceSpy.dismiss.and.returnValue(new Subject());
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.dismiss(FLAGGED_USER);
    page.dismiss(FLAGGED_USER);

    expect(moderationServiceSpy.dismiss).toHaveBeenCalledTimes(1);
  });

  it('suspend() does nothing when the admin cancels the reason prompt', () => {
    moderationServiceSpy.flagged.and.returnValue(of({ flagged: [FLAGGED_USER] }));
    spyOn(window, 'prompt').and.returnValue(null);
    const fixture = createComponent();

    fixture.componentInstance.suspend(FLAGGED_USER);

    expect(adminServiceSpy.suspend).not.toHaveBeenCalled();
  });

  it('suspend() suspends the account then dismisses the flag, given a reason', () => {
    moderationServiceSpy.flagged.and.returnValue(of({ flagged: [FLAGGED_USER] }));
    spyOn(window, 'prompt').and.returnValue('Repeated harassment reports');
    adminServiceSpy.suspend.and.returnValue(of({}));
    moderationServiceSpy.dismiss.and.returnValue(of({}));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.suspend(FLAGGED_USER);

    expect(adminServiceSpy.suspend).toHaveBeenCalledWith(1, 'Repeated harassment reports');
    expect(moderationServiceSpy.dismiss).toHaveBeenCalledWith(1);
    expect(page.flagged()).toEqual([]);
  });

  it('deleteAccount() does nothing without confirmation', () => {
    moderationServiceSpy.flagged.and.returnValue(of({ flagged: [FLAGGED_USER] }));
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = createComponent();

    fixture.componentInstance.deleteAccount(FLAGGED_USER);

    expect(moderationServiceSpy.deleteAccount).not.toHaveBeenCalled();
  });

  it('deleteAccount() removes the user from the queue once confirmed', () => {
    moderationServiceSpy.flagged.and.returnValue(of({ flagged: [FLAGGED_USER] }));
    spyOn(window, 'confirm').and.returnValue(true);
    moderationServiceSpy.deleteAccount.and.returnValue(of({}));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.deleteAccount(FLAGGED_USER);

    expect(moderationServiceSpy.deleteAccount).toHaveBeenCalledWith(1);
    expect(page.flagged()).toEqual([]);
  });
});
