import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GuestListPage } from './guest-list.page';
import { DiningTableService, TableGuest } from '../../services/dining-table.service';

const GUEST: TableGuest = { id: 1, name: 'Bilal', role: null, isHost: false };

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('GuestListPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent(id: string | null = '5') {
    TestBed.configureTestingModule({
      imports: [GuestListPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(GuestListPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['guests']);
  });

  it('loads the guest list for the routed table id', () => {
    tableServiceSpy.guests.and.returnValue(of({ guests: [GUEST] }));

    const fixture = createComponent('5');

    expect(tableServiceSpy.guests).toHaveBeenCalledWith('5');
    expect(fixture.componentInstance.guests()).toEqual([GUEST]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('does not call the service and stops loading when there is no route id', () => {
    const fixture = createComponent(null);

    expect(tableServiceSpy.guests).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('stops loading (without crashing) when the request fails', () => {
    tableServiceSpy.guests.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent('5');

    expect(fixture.componentInstance.guests()).toEqual([]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
