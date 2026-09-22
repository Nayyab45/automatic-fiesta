import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TableDetailsGuestsPage } from './table-details-guests.page';
import { DiningTable, DiningTableService, TableGuest } from '../../services/dining-table.service';

const TABLE = { id: 5, seatsAvailable: 3, restaurant: { name: 'Kolachi' } } as unknown as DiningTable;
const GUEST: TableGuest = { id: 1, name: 'Bilal', role: null, isHost: false };

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('TableDetailsGuestsPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent(id: string | null = '5') {
    TestBed.configureTestingModule({
      imports: [TableDetailsGuestsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(TableDetailsGuestsPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['get', 'guests']);
    tableServiceSpy.get.and.returnValue(of({ table: TABLE }));
    tableServiceSpy.guests.and.returnValue(of({ guests: [GUEST] }));
  });

  it('loads the table and its guests, and derives availableSeats from the table', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.table()).toEqual(TABLE);
    expect(page.guests()).toEqual([GUEST]);
    expect(page.availableSeats()).toBe(3);
    expect(page.loading()).toBeFalse();
  });

  it('availableSeatSlots() returns an array with one entry per open seat', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.availableSeatSlots().length).toBe(3);
  });

  it('share() uses the native Share plugin, which delegates to the Web Share API on web', async () => {
    const fixture = createComponent();
    const shareSpy = jasmine.createSpy('share').and.returnValue(Promise.resolve());
    (navigator as unknown as { share: unknown }).share = shareSpy;

    await fixture.componentInstance.share();

    expect(shareSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ title: 'Kolachi', text: 'Join me at Kolachi' }),
    );
    (navigator as unknown as { share: unknown }).share = undefined;
  });

  it('share() falls back to the clipboard when the Web Share API is unavailable', async () => {
    const fixture = createComponent();
    // Headless Chrome actually implements navigator.share -- assigning
    // undefined (not delete, which would just uncover that real
    // implementation again) is what makes the Share plugin's web
    // implementation genuinely unavailable here.
    (navigator as unknown as { share: unknown }).share = undefined;
    const writeTextSpy = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());

    await fixture.componentInstance.share();

    expect(writeTextSpy).toHaveBeenCalled();
  });

  it('does not call the service and stops loading when there is no route id', () => {
    const fixture = createComponent(null);
    expect(tableServiceSpy.get).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
