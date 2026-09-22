import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RequestSeatPage } from './request-seat.page';
import { DiningTable, DiningTableService, SeatRequest } from '../../services/dining-table.service';

const TABLE = { id: 5, title: 'Dinner' } as unknown as DiningTable;

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('RequestSeatPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent(id: string | null = '5') {
    TestBed.configureTestingModule({
      imports: [RequestSeatPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(RequestSeatPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['get', 'requestSeat']);
    tableServiceSpy.get.and.returnValue(of({ table: TABLE }));
  });

  it('loads the table for the routed id', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.table()).toEqual(TABLE);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('sendRequest() navigates to the request-status page on success', () => {
    tableServiceSpy.requestSeat.and.returnValue(of({ seatRequest: {} as SeatRequest }));

    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    fixture.componentInstance.sendRequest();

    expect(tableServiceSpy.requestSeat).toHaveBeenCalledWith('5');
    expect(navigateSpy).toHaveBeenCalledWith('/request-status/5');
  });

  it('sendRequest() shows the server error and resets submitting on failure', () => {
    tableServiceSpy.requestSeat.and.returnValue(throwError(() => ({ error: { message: 'Table is full' } })));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.sendRequest();

    expect(page.submitting()).toBeFalse();
    expect(page.errorMessage()).toBe('Table is full');
  });

  it('sendRequest() does nothing without a route id', () => {
    const fixture = createComponent(null);
    fixture.componentInstance.sendRequest();
    expect(tableServiceSpy.requestSeat).not.toHaveBeenCalled();
  });
});
