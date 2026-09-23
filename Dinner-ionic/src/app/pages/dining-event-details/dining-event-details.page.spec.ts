import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DiningEventDetailsPage } from './dining-event-details.page';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';

const TABLE = { id: 5, title: 'Dinner', restaurant: { name: 'Kolachi' } } as unknown as DiningTable;

const PAST_TABLE = {
  id: 5,
  title: 'Dinner',
  dateTime: '2026-01-01T19:00:00.000Z',
  guestCount: 2,
  seatsTotal: 4,
  note: null,
  restaurant: { name: 'Kolachi', photoUrl: '' },
  isPast: true,
  isHost: false,
  hasReviewed: false,
} as unknown as DiningTable;

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('DiningEventDetailsPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent(id: string | null = '5') {
    TestBed.configureTestingModule({
      imports: [DiningEventDetailsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(DiningEventDetailsPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['get', 'mySeatRequest', 'patchSeatRequest']);
    tableServiceSpy.mySeatRequest.and.returnValue(of({ seatRequest: null }));
  });

  it('loads the table for the routed id', () => {
    tableServiceSpy.get.and.returnValue(of({ table: TABLE }));

    const fixture = createComponent('5');

    expect(tableServiceSpy.get).toHaveBeenCalledWith('5');
    expect(fixture.componentInstance.table()).toEqual(TABLE);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('does not call the service and stops loading when there is no route id', () => {
    const fixture = createComponent(null);

    expect(tableServiceSpy.get).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('stops loading (without crashing) when the request fails', () => {
    tableServiceSpy.get.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent('5');

    expect(fixture.componentInstance.table()).toBeNull();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('shows "Leave a review" to the host of a past, unreviewed table', () => {
    tableServiceSpy.get.and.returnValue(of({ table: { ...PAST_TABLE, isHost: true } }));

    const fixture = createComponent('5');
    fixture.detectChanges();

    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((el) =>
      (el as HTMLElement).textContent?.includes('Leave a review'),
    );
    expect(button).toBeTruthy();
  });

  it('shows "Leave a review" to a guest of a past, unreviewed table', () => {
    tableServiceSpy.get.and.returnValue(of({ table: { ...PAST_TABLE, isHost: false } }));

    const fixture = createComponent('5');
    fixture.detectChanges();

    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((el) =>
      (el as HTMLElement).textContent?.includes('Leave a review'),
    );
    expect(button).toBeTruthy();
  });

  it('hides "Leave a review" once the table has already been reviewed', () => {
    tableServiceSpy.get.and.returnValue(of({ table: { ...PAST_TABLE, isHost: true, hasReviewed: true } }));

    const fixture = createComponent('5');
    fixture.detectChanges();

    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((el) =>
      (el as HTMLElement).textContent?.includes('Leave a review'),
    );
    expect(button).toBeFalsy();
  });

  it('does not fetch a seat request for the host or an existing member', () => {
    tableServiceSpy.get.and.returnValue(of({ table: { ...TABLE, isHost: true } }));
    createComponent('5');
    expect(tableServiceSpy.mySeatRequest).not.toHaveBeenCalled();
  });

  it('shows the invite as accepted and updates the table once respondToInvite("confirmed") resolves', () => {
    const nonMemberTable = { ...TABLE, isHost: false, isMember: false, guestCount: 2 } as unknown as DiningTable;
    tableServiceSpy.get.and.returnValue(of({ table: nonMemberTable }));
    tableServiceSpy.mySeatRequest.and.returnValue(
      of({ seatRequest: { id: 9, tableId: 5, userId: 1, status: 'sent', message: null, createdAt: '', updatedAt: '' } }),
    );
    tableServiceSpy.patchSeatRequest.and.returnValue(
      of({ seatRequest: { id: 9, tableId: 5, userId: 1, status: 'confirmed', message: null, createdAt: '', updatedAt: '' } }),
    );

    const fixture = createComponent('5');
    const page = fixture.componentInstance;
    expect(page.mySeatRequest()?.status).toBe('sent');

    page.respondToInvite('confirmed');

    expect(tableServiceSpy.patchSeatRequest).toHaveBeenCalledWith(9, 'confirmed');
    expect(page.mySeatRequest()?.status).toBe('confirmed');
    expect(page.table()?.isMember).toBeTrue();
    expect(page.table()?.guestCount).toBe(3);
    expect(page.responding()).toBeFalse();
  });
});
