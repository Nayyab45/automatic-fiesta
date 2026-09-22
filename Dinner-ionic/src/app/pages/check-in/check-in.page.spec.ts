import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CheckInPage } from './check-in.page';
import { CheckIn, DiningTable, DiningTableService } from '../../services/dining-table.service';

const TABLE = { id: 5, title: 'Dinner' } as unknown as DiningTable;

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('CheckInPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent(id: string | null = '5') {
    TestBed.configureTestingModule({
      imports: [CheckInPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(CheckInPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['get', 'myCheckIn', 'checkIn']);
    tableServiceSpy.get.and.returnValue(of({ table: TABLE }));
  });

  it('loads the table and treats an active (not-yet-checked-out) check-in as checked in', () => {
    const activeCheckIn = { id: 1, tableId: 5, userId: 1, checkedInAt: new Date().toISOString(), checkedOutAt: null } as CheckIn;
    tableServiceSpy.myCheckIn.and.returnValue(of({ checkIn: activeCheckIn }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.table()).toEqual(TABLE);
    expect(page.checkedIn()).toBeTrue();
  });

  it('treats an already-checked-out check-in as not checked in', () => {
    const pastCheckIn = { id: 1, tableId: 5, userId: 1, checkedInAt: '2020-01-01', checkedOutAt: '2020-01-01' } as CheckIn;
    tableServiceSpy.myCheckIn.and.returnValue(of({ checkIn: pastCheckIn }));

    const fixture = createComponent();
    expect(fixture.componentInstance.checkedIn()).toBeFalse();
  });

  it('treats no check-in at all as not checked in', () => {
    tableServiceSpy.myCheckIn.and.returnValue(of({ checkIn: null }));
    const fixture = createComponent();
    expect(fixture.componentInstance.checkedIn()).toBeFalse();
  });

  it('checkIn() marks checkedIn true on success', () => {
    tableServiceSpy.myCheckIn.and.returnValue(of({ checkIn: null }));
    tableServiceSpy.checkIn.and.returnValue(of({ checkIn: {} as CheckIn }));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.checkIn();

    expect(tableServiceSpy.checkIn).toHaveBeenCalledWith('5');
    expect(page.checkedIn()).toBeTrue();
  });

  it('checkIn() shows an error message on failure', () => {
    tableServiceSpy.myCheckIn.and.returnValue(of({ checkIn: null }));
    tableServiceSpy.checkIn.and.returnValue(throwError(() => ({ error: { message: 'Too far from the restaurant' } })));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.checkIn();

    expect(page.checkedIn()).toBeFalse();
    expect(page.errorMessage()).toBe('Too far from the restaurant');
  });

  it('does not call the service and stops loading when there is no route id', () => {
    const fixture = createComponent(null);
    expect(tableServiceSpy.get).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
