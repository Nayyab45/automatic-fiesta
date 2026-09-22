import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RequestStatusPage } from './request-status.page';
import { DiningTableService, SeatRequest } from '../../services/dining-table.service';

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('RequestStatusPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent(id: string | null = '5') {
    TestBed.configureTestingModule({
      imports: [RequestStatusPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(RequestStatusPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['mySeatRequest']);
  });

  it('polls immediately on construction', () => {
    tableServiceSpy.mySeatRequest.and.returnValue(of({ seatRequest: { status: 'sent' } as SeatRequest }));

    const fixture = createComponent();

    expect(tableServiceSpy.mySeatRequest).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.seatRequest()?.status).toBe('sent');
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('polls again every 4 seconds until destroyed', () => {
    jasmine.clock().install();
    try {
      tableServiceSpy.mySeatRequest.and.returnValue(of({ seatRequest: { status: 'sent' } as SeatRequest }));
      const fixture = createComponent();

      jasmine.clock().tick(4000);
      expect(tableServiceSpy.mySeatRequest).toHaveBeenCalledTimes(2);

      jasmine.clock().tick(4000);
      expect(tableServiceSpy.mySeatRequest).toHaveBeenCalledTimes(3);

      fixture.destroy();
      jasmine.clock().tick(8000);
      // No further polls once destroyed.
      expect(tableServiceSpy.mySeatRequest).toHaveBeenCalledTimes(3);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('does not poll and stops loading when there is no route id', () => {
    const fixture = createComponent(null);
    expect(tableServiceSpy.mySeatRequest).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
