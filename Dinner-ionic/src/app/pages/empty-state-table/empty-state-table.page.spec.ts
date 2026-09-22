import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EmptyStateTablePage } from './empty-state-table.page';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';

function makeTable(overrides: Partial<DiningTable> = {}): DiningTable {
  return {
    id: 1,
    title: 'Dinner',
    restaurant: { name: 'Kolachi', photoUrl: null, address: null, city: 'Karachi', rating: 4.8, cuisineTags: 'Pakistani' },
    host: { id: 2, name: 'Host' },
    isPast: false,
    ...overrides,
  } as unknown as DiningTable;
}

describe('EmptyStateTablePage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [EmptyStateTablePage],
      providers: [provideRouter([]), { provide: DiningTableService, useValue: tableServiceSpy }],
    });
    return TestBed.createComponent(EmptyStateTablePage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['discover']);
  });

  it('loads public discoverable tables and stops loading', () => {
    tableServiceSpy.discover.and.returnValue(of({ tables: [makeTable({ id: 1 }), makeTable({ id: 2 })] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.tables().length).toBe(2);
    expect(page.loading()).toBeFalse();
  });

  it('stops loading (without crashing) when the request fails', () => {
    tableServiceSpy.discover.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.tables()).toEqual([]);
    expect(page.loading()).toBeFalse();
  });
});
