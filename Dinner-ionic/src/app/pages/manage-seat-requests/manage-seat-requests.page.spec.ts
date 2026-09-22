import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ManageSeatRequestsPage } from './manage-seat-requests.page';
import { DiningTable, DiningTableService, SeatRequest } from '../../services/dining-table.service';

const TABLE = { id: 5, guestCount: 2 } as unknown as DiningTable;

function makeRequest(overrides: Partial<SeatRequest> = {}): SeatRequest {
  return {
    id: 1,
    tableId: 5,
    userId: 9,
    status: 'sent',
    message: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('ManageSeatRequestsPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent(id: string | null = '5') {
    TestBed.configureTestingModule({
      imports: [ManageSeatRequestsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(ManageSeatRequestsPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['get', 'seatRequests', 'patchSeatRequest']);
    tableServiceSpy.get.and.returnValue(of({ table: TABLE }));
  });

  it('splits requests into pending (sent) and resolved (confirmed/declined)', () => {
    tableServiceSpy.seatRequests.and.returnValue(
      of({
        seatRequests: [
          makeRequest({ id: 1, status: 'sent' }),
          makeRequest({ id: 2, status: 'confirmed' }),
          makeRequest({ id: 3, status: 'declined' }),
        ],
      }),
    );

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.pending().map((r) => r.id)).toEqual([1]);
    expect(page.resolved().map((r) => r.id)).toEqual([2, 3]);
    expect(page.loading()).toBeFalse();
  });

  it('respond() confirming a request updates its status and increments the seated guest count', () => {
    const request = makeRequest({ id: 1, status: 'sent' });
    tableServiceSpy.seatRequests.and.returnValue(of({ seatRequests: [request] }));
    tableServiceSpy.patchSeatRequest.and.returnValue(of({ seatRequest: { ...request, status: 'confirmed' } }));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.respond(request, 'confirmed');

    expect(tableServiceSpy.patchSeatRequest).toHaveBeenCalledWith(1, 'confirmed');
    expect(page.requests()[0].status).toBe('confirmed');
    expect(page.table()?.guestCount).toBe(3);
    expect(page.actioningId()).toBeNull();
  });

  it('respond() declining a request updates its status without touching the guest count', () => {
    const request = makeRequest({ id: 1, status: 'sent' });
    tableServiceSpy.seatRequests.and.returnValue(of({ seatRequests: [request] }));
    tableServiceSpy.patchSeatRequest.and.returnValue(of({ seatRequest: { ...request, status: 'declined' } }));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.respond(request, 'declined');

    expect(page.requests()[0].status).toBe('declined');
    expect(page.table()?.guestCount).toBe(2);
  });

  it('respond() ignores a second call while one is already in flight', () => {
    const request = makeRequest({ id: 1, status: 'sent' });
    tableServiceSpy.seatRequests.and.returnValue(of({ seatRequests: [request] }));
    // Never emits, simulating an in-flight request.
    tableServiceSpy.patchSeatRequest.and.returnValue(new Observable());

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.respond(request, 'confirmed');
    page.respond(request, 'declined');

    expect(tableServiceSpy.patchSeatRequest).toHaveBeenCalledTimes(1);
  });

  it('respond() clears actioningId (without crashing) on failure', () => {
    const request = makeRequest({ id: 1, status: 'sent' });
    tableServiceSpy.seatRequests.and.returnValue(of({ seatRequests: [request] }));
    tableServiceSpy.patchSeatRequest.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.respond(request, 'confirmed');

    expect(page.actioningId()).toBeNull();
  });
});
