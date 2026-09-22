import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminTablesPage } from './admin-tables.page';
import { AdminTable, AdminService } from '../../services/admin.service';

function makeTable(overrides: Partial<AdminTable> = {}): AdminTable {
  return {
    id: 1,
    title: 'Friday Dinner',
    hostUserId: 1,
    hostName: 'Sam',
    restaurantName: 'Kolachi',
    gatheringType: 'dinner',
    dateTime: new Date().toISOString(),
    seatsTotal: 4,
    visibility: 'public',
    audience: 'everyone',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AdminTablesPage', () => {
  let adminServiceSpy: jasmine.SpyObj<AdminService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AdminTablesPage],
      providers: [provideRouter([]), { provide: AdminService, useValue: adminServiceSpy }],
    });
    return TestBed.createComponent(AdminTablesPage);
  }

  beforeEach(() => {
    adminServiceSpy = jasmine.createSpyObj('AdminService', ['tables', 'deleteTable']);
  });

  it('loads all tables on construction', () => {
    adminServiceSpy.tables.and.returnValue(of({ tables: [makeTable()] }));
    const fixture = createComponent();
    expect(fixture.componentInstance.tables().length).toBe(1);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('marks the page forbidden on a 403', () => {
    adminServiceSpy.tables.and.returnValue(throwError(() => ({ status: 403 })));
    const fixture = createComponent();
    expect(fixture.componentInstance.forbidden()).toBeTrue();
  });

  it('query filters by title, host, or restaurant name, case-insensitively', () => {
    adminServiceSpy.tables.and.returnValue(
      of({
        tables: [
          makeTable({ id: 1, title: 'Friday Dinner', hostName: 'Sam', restaurantName: 'Kolachi' }),
          makeTable({ id: 2, title: 'Brunch', hostName: 'Ali', restaurantName: 'Xander' }),
        ],
      }),
    );
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.query.set('kolachi');
    expect(page.tables().map((t) => t.id)).toEqual([1]);

    page.query.set('ALI');
    expect(page.tables().map((t) => t.id)).toEqual([2]);
  });

  it('onlyPublic filters out private tables', () => {
    adminServiceSpy.tables.and.returnValue(
      of({ tables: [makeTable({ id: 1, visibility: 'public' }), makeTable({ id: 2, visibility: 'private' })] }),
    );
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.onlyPublic.set(true);

    expect(page.tables().map((t) => t.id)).toEqual([1]);
  });

  it('remove() does nothing without confirmation', () => {
    adminServiceSpy.tables.and.returnValue(of({ tables: [makeTable()] }));
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = createComponent();

    fixture.componentInstance.remove(makeTable());

    expect(adminServiceSpy.deleteTable).not.toHaveBeenCalled();
  });

  it('remove() removes the table from the list once confirmed', () => {
    const table = makeTable({ id: 1 });
    adminServiceSpy.tables.and.returnValue(of({ tables: [table] }));
    spyOn(window, 'confirm').and.returnValue(true);
    adminServiceSpy.deleteTable.and.returnValue(of({}));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.remove(table);

    expect(adminServiceSpy.deleteTable).toHaveBeenCalledWith(1);
    expect(page.tables()).toEqual([]);
  });
});
