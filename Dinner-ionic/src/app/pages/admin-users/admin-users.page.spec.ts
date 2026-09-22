import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AdminUsersPage } from './admin-users.page';
import { AdminUserRow, AdminService } from '../../services/admin.service';

const USER: AdminUserRow = {
  id: 1,
  name: 'Sam',
  email: 'sam@example.com',
  createdAt: new Date().toISOString(),
  isAdmin: false,
  suspendedAt: null,
  flaggedAt: null,
  verified: true,
};

describe('AdminUsersPage', () => {
  let adminServiceSpy: jasmine.SpyObj<AdminService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AdminUsersPage],
      providers: [provideRouter([]), { provide: AdminService, useValue: adminServiceSpy }],
    });
    return TestBed.createComponent(AdminUsersPage);
  }

  beforeEach(() => {
    adminServiceSpy = jasmine.createSpyObj('AdminService', ['users']);
    adminServiceSpy.users.and.returnValue(of({ users: [USER] }));
  });

  it('loads the user list with empty search/status by default', () => {
    const fixture = createComponent();
    expect(adminServiceSpy.users).toHaveBeenCalledWith('', '');
    expect(fixture.componentInstance.users()).toEqual([USER]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('marks the page forbidden on a 403', () => {
    adminServiceSpy.users.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const fixture = createComponent();
    expect(fixture.componentInstance.forbidden()).toBeTrue();
  });

  it('selectStatus() sets the filter and reloads', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    adminServiceSpy.users.calls.reset();

    page.selectStatus('suspended');

    expect(page.status).toBe('suspended');
    expect(adminServiceSpy.users).toHaveBeenCalledWith('', 'suspended');
  });

  it('load() trims the search term before sending it', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    adminServiceSpy.users.calls.reset();
    page.search = '  sam  ';

    page.load();

    expect(adminServiceSpy.users).toHaveBeenCalledWith('sam', '');
  });
});
