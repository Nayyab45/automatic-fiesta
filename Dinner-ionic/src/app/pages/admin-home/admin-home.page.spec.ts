import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminHomePage } from './admin-home.page';
import { AdminService, AdminStats } from '../../services/admin.service';

const STATS: AdminStats = {
  totalUsers: 100,
  totalRestaurants: 20,
  totalEvents: 30,
  activeEvents: 5,
  pendingVerifications: 2,
  flaggedUsers: 1,
  suspendedUsers: 0,
  openSupportTickets: 3,
  totalReports: 4,
};

describe('AdminHomePage', () => {
  let adminServiceSpy: jasmine.SpyObj<AdminService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AdminHomePage],
      providers: [provideRouter([]), { provide: AdminService, useValue: adminServiceSpy }],
    });
    return TestBed.createComponent(AdminHomePage);
  }

  beforeEach(() => {
    adminServiceSpy = jasmine.createSpyObj('AdminService', ['stats']);
  });

  it('loads the dashboard stats', () => {
    adminServiceSpy.stats.and.returnValue(of(STATS));
    const fixture = createComponent();
    expect(fixture.componentInstance.stats()).toEqual(STATS);
  });

  it('leaves stats null (without crashing) when the request fails', () => {
    adminServiceSpy.stats.and.returnValue(throwError(() => ({ status: 403 })));
    const fixture = createComponent();
    expect(fixture.componentInstance.stats()).toBeNull();
  });
});
