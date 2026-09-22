import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminUserDetailPage } from './admin-user-detail.page';
import { AdminService, AdminUserDetail, AdminUserReport } from '../../services/admin.service';
import { ModerationService } from '../../services/moderation.service';

const USER: AdminUserDetail = {
  id: 1,
  name: 'Sam',
  email: 'sam@example.com',
  createdAt: new Date().toISOString(),
  isAdmin: false,
  suspendedAt: null,
  suspendedReason: null,
  flaggedAt: '2026-01-01',
  age: 25,
  city: 'Karachi',
  bio: null,
  photoUrl: null,
  gender: null,
  verified: true,
  verificationStatus: 'approved',
  verificationSubmittedAt: null,
  rating: 4.5,
  blockCount: 2,
  reportCount: 1,
  tablesJoinedCount: 3,
};

const REPORT: AdminUserReport = { id: 1, reason: 'harassment', details: null, createdAt: new Date().toISOString(), reporterName: 'Ali' };

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('AdminUserDetailPage', () => {
  let adminServiceSpy: jasmine.SpyObj<AdminService>;
  let moderationServiceSpy: jasmine.SpyObj<ModerationService>;

  function createComponent(id: string | null = '1') {
    TestBed.configureTestingModule({
      imports: [AdminUserDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: AdminService, useValue: adminServiceSpy },
        { provide: ModerationService, useValue: moderationServiceSpy },
      ],
    });
    return TestBed.createComponent(AdminUserDetailPage);
  }

  beforeEach(() => {
    adminServiceSpy = jasmine.createSpyObj('AdminService', ['user', 'userReports', 'suspend', 'unsuspend']);
    moderationServiceSpy = jasmine.createSpyObj('ModerationService', ['deleteAccount']);
    adminServiceSpy.user.and.returnValue(of({ user: USER }));
    adminServiceSpy.userReports.and.returnValue(of({ reports: [REPORT] }));
  });

  it('loads the user detail and their reports for the routed id', () => {
    const fixture = createComponent('1');
    const page = fixture.componentInstance;

    expect(adminServiceSpy.user).toHaveBeenCalledWith('1');
    expect(page.user()).toEqual(USER);
    expect(page.reports()).toEqual([REPORT]);
    expect(page.loading()).toBeFalse();
  });

  it('does not load anything without a route id', () => {
    const fixture = createComponent(null);
    expect(adminServiceSpy.user).not.toHaveBeenCalled();
  });

  describe('suspend()', () => {
    it('does nothing when the admin cancels the reason prompt', () => {
      spyOn(window, 'prompt').and.returnValue(null);
      const fixture = createComponent();

      fixture.componentInstance.suspend();

      expect(adminServiceSpy.suspend).not.toHaveBeenCalled();
    });

    it('suspends with the given reason, then reloads the user', () => {
      spyOn(window, 'prompt').and.returnValue('Repeated violations');
      adminServiceSpy.suspend.and.returnValue(of({}));
      const fixture = createComponent();
      const page = fixture.componentInstance;

      page.suspend();

      expect(adminServiceSpy.suspend).toHaveBeenCalledWith(1, 'Repeated violations');
      expect(adminServiceSpy.user).toHaveBeenCalledTimes(2);
      expect(page.acting()).toBeFalse();
    });
  });

  it('unsuspend() runs the unsuspend action and reloads', () => {
    adminServiceSpy.unsuspend.and.returnValue(of({}));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.unsuspend();

    expect(adminServiceSpy.unsuspend).toHaveBeenCalledWith(1);
    expect(adminServiceSpy.user).toHaveBeenCalledTimes(2);
  });

  it('a failed action shows an error and stops acting', () => {
    adminServiceSpy.unsuspend.and.returnValue(throwError(() => new Error('down')));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.unsuspend();

    expect(page.acting()).toBeFalse();
    expect(page.error()).toBe('That action failed. Try again.');
  });

  describe('deleteAccount()', () => {
    it('does nothing without confirmation', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const fixture = createComponent();

      fixture.componentInstance.deleteAccount();

      expect(moderationServiceSpy.deleteAccount).not.toHaveBeenCalled();
    });

    it('deletes the account and navigates back to the user list once confirmed', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      moderationServiceSpy.deleteAccount.and.returnValue(of({}));
      const fixture = createComponent();
      const router = TestBed.inject(Router);
      const navigateSpy = spyOn(router, 'navigateByUrl');

      fixture.componentInstance.deleteAccount();

      expect(moderationServiceSpy.deleteAccount).toHaveBeenCalledWith(1);
      expect(navigateSpy).toHaveBeenCalledWith('/admin/users');
    });

    it('shows an error (without navigating away) on failure', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      moderationServiceSpy.deleteAccount.and.returnValue(throwError(() => new Error('down')));
      const fixture = createComponent();
      const router = TestBed.inject(Router);
      const navigateSpy = spyOn(router, 'navigateByUrl');

      const page = fixture.componentInstance;
      page.deleteAccount();

      expect(page.acting()).toBeFalse();
      expect(page.error()).toContain("Couldn't delete");
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
