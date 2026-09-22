import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HomePage } from './home.page';
import { WhatsNewService } from '../../services/whats-new.service';
import { AuthService } from '../../services/auth.service';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';
import { Match, ProfileService } from '../../services/profile.service';
import { MessagingService } from '../../services/messaging.service';

function makeTable(overrides: Partial<DiningTable>): DiningTable {
  return {
    id: 1,
    title: 'Dinner',
    restaurantId: 1,
    hostUserId: 1,
    gatheringType: 'dinner',
    dateTime: new Date().toISOString(),
    seatsTotal: 4,
    visibility: 'public',
    audience: 'everyone',
    atmosphere: null,
    note: null,
    pricePerPerson: null,
    totalBill: null,
    createdAt: new Date().toISOString(),
    restaurant: { name: 'Kolachi', photoUrl: null, address: null, city: 'Karachi', rating: 4.8, cuisineTags: 'Pakistani' },
    host: { id: 1, name: 'Host' },
    guestCount: 1,
    seatsAvailable: 3,
    isPast: false,
    isHost: true,
    isMember: true,
    hasReviewed: false,
    ...overrides,
  } as DiningTable;
}

const MATCH = {
  id: 2,
  name: 'Sara',
  score: 90,
  sameCity: true,
  sharedInterests: [],
  sharedFavoriteFoods: [],
  reasons: ['Loves BBQ too'],
  aiPowered: false,
  rating: 4.5,
  tablesJoinedCount: 2,
} as unknown as Match;

describe('HomePage', () => {
  let whatsNewSpy: jasmine.SpyObj<WhatsNewService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;
  let profileServiceSpy: jasmine.SpyObj<ProfileService>;
  let messagingServiceSpy: jasmine.SpyObj<MessagingService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        { provide: WhatsNewService, useValue: whatsNewSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: DiningTableService, useValue: tableServiceSpy },
        { provide: ProfileService, useValue: profileServiceSpy },
        { provide: MessagingService, useValue: messagingServiceSpy },
      ],
    });
    const fixture = TestBed.createComponent(HomePage);
    // HomePage's data loading lives in ngOnInit(), which only runs on the
    // first change detection pass, not at construction.
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    whatsNewSpy = jasmine.createSpyObj('WhatsNewService', ['shouldShow', 'markSeen']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['listMine']);
    // 'me' is unused by HomePage itself -- it's here because the
    // <app-user-avatar> child component this page renders calls it in its
    // own constructor, which TestBed.createComponent() runs eagerly.
    profileServiceSpy = jasmine.createSpyObj('ProfileService', ['matches', 'me']);
    messagingServiceSpy = jasmine.createSpyObj('MessagingService', ['getOrCreateWith']);

    whatsNewSpy.shouldShow.and.returnValue(false);
    authServiceSpy.currentUser.and.returnValue({ name: 'Sam Ali' } as never);
    profileServiceSpy.me.and.returnValue(
      of({ profile: { photoUrl: null, name: 'Sam Ali' } }) as unknown as ReturnType<typeof profileServiceSpy.me>,
    );
  });

  it('derives firstName from the current user\'s full name', () => {
    tableServiceSpy.listMine.and.returnValue(of({ tables: [] }));
    profileServiceSpy.matches.and.returnValue(of({ matches: [] }));

    const fixture = createComponent();
    expect(fixture.componentInstance.firstName()).toBe('Sam');
  });

  it('falls back to "there" when there is no signed-in user yet', () => {
    authServiceSpy.currentUser.and.returnValue(null as never);
    tableServiceSpy.listMine.and.returnValue(of({ tables: [] }));
    profileServiceSpy.matches.and.returnValue(of({ matches: [] }));

    const fixture = createComponent();
    expect(fixture.componentInstance.firstName()).toBe('there');
  });

  it('picks the soonest upcoming table, ignoring past ones, on init', () => {
    const past = makeTable({ id: 1, isPast: true, dateTime: '2020-01-01T00:00:00Z' });
    const soon = makeTable({ id: 2, isPast: false, dateTime: '2099-01-01T00:00:00Z' });
    const later = makeTable({ id: 3, isPast: false, dateTime: '2099-06-01T00:00:00Z' });
    tableServiceSpy.listMine.and.returnValue(of({ tables: [later, past, soon] }));
    profileServiceSpy.matches.and.returnValue(of({ matches: [] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.upcomingTable()?.id).toBe(2);
    expect(page.loadingTables()).toBeFalse();
  });

  it('sets upcomingTable to null when there are no upcoming tables', () => {
    tableServiceSpy.listMine.and.returnValue(of({ tables: [] }));
    profileServiceSpy.matches.and.returnValue(of({ matches: [] }));

    const fixture = createComponent();
    expect(fixture.componentInstance.upcomingTable()).toBeNull();
  });

  it('caps matches at 6 and stops the loading flag', () => {
    const matches = Array.from({ length: 10 }, (_, i) => ({ ...MATCH, id: i }));
    tableServiceSpy.listMine.and.returnValue(of({ tables: [] }));
    profileServiceSpy.matches.and.returnValue(of({ matches }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.matches().length).toBe(6);
    expect(page.loadingMatches()).toBeFalse();
  });

  it('stops loading (without crashing) when either request fails', () => {
    tableServiceSpy.listMine.and.returnValue(throwError(() => new Error('network error')));
    profileServiceSpy.matches.and.returnValue(throwError(() => new Error('network error')));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.loadingTables()).toBeFalse();
    expect(page.upcomingTable()).toBeNull();
    expect(page.loadingMatches()).toBeFalse();
    expect(page.matches()).toEqual([]);
  });

  it('shows the What\'s New banner only when the service says to', () => {
    whatsNewSpy.shouldShow.and.returnValue(true);
    tableServiceSpy.listMine.and.returnValue(of({ tables: [] }));
    profileServiceSpy.matches.and.returnValue(of({ matches: [] }));

    const fixture = createComponent();
    expect(fixture.componentInstance.showWhatsNew).toBeTrue();
  });

  it('connect() opens (or creates) a DM and navigates to the group chat', () => {
    tableServiceSpy.listMine.and.returnValue(of({ tables: [] }));
    profileServiceSpy.matches.and.returnValue(of({ matches: [] }));
    messagingServiceSpy.getOrCreateWith.and.returnValue(of({ conversation: { id: 77, person: null } }));

    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    fixture.componentInstance.connect(MATCH);

    expect(messagingServiceSpy.getOrCreateWith).toHaveBeenCalledWith(MATCH.id);
    expect(navigateSpy).toHaveBeenCalledWith('/dining-group-chat/dm/77');
  });
});
