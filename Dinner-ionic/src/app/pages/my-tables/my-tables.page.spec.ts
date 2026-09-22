import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MyTablesPage } from './my-tables.page';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';

function makeTable(overrides: Partial<DiningTable> = {}): DiningTable {
  return { id: 1, title: 'Dinner', isPast: false, ...overrides } as unknown as DiningTable;
}

describe('MyTablesPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let profileServiceSpy: jasmine.SpyObj<ProfileService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [MyTablesPage],
      providers: [
        provideRouter([]),
        { provide: DiningTableService, useValue: tableServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ProfileService, useValue: profileServiceSpy },
      ],
    });
    return TestBed.createComponent(MyTablesPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['listMine']);
    // Unused by this page directly -- its <app-user-avatar> child component
    // calls these in its own constructor, which runs eagerly on creation.
    authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    authServiceSpy.currentUser.and.returnValue({ name: 'Sam Ali' } as never);
    profileServiceSpy = jasmine.createSpyObj('ProfileService', ['me']);
    profileServiceSpy.me.and.returnValue(
      of({ profile: { photoUrl: null, name: 'Sam Ali' } }) as unknown as ReturnType<typeof profileServiceSpy.me>,
    );
  });

  it('splits tables into upcoming and past', () => {
    tableServiceSpy.listMine.and.returnValue(
      of({ tables: [makeTable({ id: 1, isPast: false }), makeTable({ id: 2, isPast: true })] }),
    );

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.upcoming().map((t) => t.id)).toEqual([1]);
    expect(page.past().map((t) => t.id)).toEqual([2]);
    expect(page.loading()).toBeFalse();
  });

  it('stops loading (without crashing) when the request fails', () => {
    tableServiceSpy.listMine.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent();
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.upcoming()).toEqual([]);
  });
});
