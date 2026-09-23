import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CreateTablePage } from './create-table.page';
import { Restaurant, RestaurantDetail, RestaurantService } from '../../services/restaurant.service';
import { DiningTable, DiningTableService } from '../../services/dining-table.service';
import { Friend, FriendsService } from '../../services/friends.service';
import { LocationService } from '../../services/location.service';
import { Match, ProfileService } from '../../services/profile.service';

function makeRestaurant(id: number, overrides: Partial<Restaurant> = {}): Restaurant {
  return { id, name: `Restaurant ${id}`, city: 'Karachi', cuisineTags: 'Pakistani', rating: 4.5, ...overrides } as unknown as Restaurant;
}

function makeRestaurantDetail(id: number, overrides: Partial<Restaurant> = {}): RestaurantDetail {
  return { ...makeRestaurant(id, overrides), dishes: [] } as unknown as RestaurantDetail;
}

const FRIEND: Friend = { id: 9, name: 'Bilal', photoUrl: null, city: 'Karachi' };
const SUGGESTION = { id: 20, name: 'Zara' } as unknown as Match;

describe('CreateTablePage', () => {
  let restaurantServiceSpy: jasmine.SpyObj<RestaurantService>;
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;
  let friendsServiceSpy: jasmine.SpyObj<FriendsService>;
  let profileServiceSpy: jasmine.SpyObj<ProfileService>;

  function createComponent(routeOverride?: Partial<ActivatedRoute>) {
    const providers: unknown[] = [
      provideRouter([]),
      { provide: RestaurantService, useValue: restaurantServiceSpy },
      { provide: DiningTableService, useValue: tableServiceSpy },
      { provide: FriendsService, useValue: friendsServiceSpy },
      { provide: ProfileService, useValue: profileServiceSpy },
    ];
    if (routeOverride) {
      providers.push({ provide: ActivatedRoute, useValue: routeOverride });
    }
    TestBed.configureTestingModule({ imports: [CreateTablePage], providers });
    return TestBed.createComponent(CreateTablePage);
  }

  beforeEach(() => {
    restaurantServiceSpy = jasmine.createSpyObj('RestaurantService', ['get', 'list', 'groupRecommendation']);
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['create', 'invite']);
    friendsServiceSpy = jasmine.createSpyObj('FriendsService', ['list']);
    profileServiceSpy = jasmine.createSpyObj('ProfileService', ['matches']);

    friendsServiceSpy.list.and.returnValue(of({ friends: [FRIEND] }));
    profileServiceSpy.matches.and.returnValue(of({ matches: [SUGGESTION, { id: 9, name: 'Bilal' } as unknown as Match] }));
    restaurantServiceSpy.list.and.returnValue(of({ restaurants: [makeRestaurant(1), makeRestaurant(2)] }));
  });

  it('loads restaurants for the currently browsed city and defaults restaurantId to the first one', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(restaurantServiceSpy.list).toHaveBeenCalledWith({ city: TestBed.inject(LocationService).current() });
    expect(page.restaurants().length).toBe(2);
    expect(page.restaurantId).toBe(1);
  });

  it('loads friends into the friends signal on construction', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.friends()).toEqual([FRIEND]);
  });

  it('loads suggestions from matches(), excluding anyone already a friend', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.suggestions()).toEqual([SUGGESTION]);
  });

  it('toggleInvitee() adds then removes an id', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.toggleInvitee(20);
    expect(page.selectedInviteeIds()).toEqual([20]);

    page.toggleInvitee(20);
    expect(page.selectedInviteeIds()).toEqual([]);
  });

  it('when arriving with a ?restaurantId query param, loads restaurants for that restaurant\'s own city', () => {
    restaurantServiceSpy.get.and.returnValue(of({ restaurant: makeRestaurantDetail(5, { city: 'Lahore' }) }));
    const fakeRoute = {
      snapshot: { queryParamMap: convertToParamMap({ restaurantId: '5' }), paramMap: convertToParamMap({}) },
      paramMap: of(convertToParamMap({})),
    } as unknown as ActivatedRoute;

    const fixture = createComponent(fakeRoute);

    expect(restaurantServiceSpy.get).toHaveBeenCalledWith(5);
    expect(restaurantServiceSpy.list).toHaveBeenCalledWith({ city: 'Lahore' });
    expect(fixture.componentInstance.restaurantId).toBe(5);
  });

  it('falls back to the browsing city when the query-param restaurant fails to load', () => {
    restaurantServiceSpy.get.and.returnValue(throwError(() => new Error('404')));
    const fakeRoute = {
      snapshot: { queryParamMap: convertToParamMap({ restaurantId: '5' }), paramMap: convertToParamMap({}) },
      paramMap: of(convertToParamMap({})),
    } as unknown as ActivatedRoute;

    createComponent(fakeRoute);

    expect(restaurantServiceSpy.list).toHaveBeenCalledWith({ city: TestBed.inject(LocationService).current() });
  });

  it('selectGatheringType() and selectAtmosphere() update the plain fields', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.selectGatheringType('Brunch');
    page.selectAtmosphere('Business Networking');
    expect(page.gatheringType).toBe('Brunch');
    expect(page.atmosphere).toBe('Business Networking');
  });

  it('toggleFriendSelection() adds then removes an id, and clears any AI suggestion', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.toggleFriendSelection(9);
    expect(page.selectedFriendIds()).toEqual([9]);

    page.toggleFriendSelection(9);
    expect(page.selectedFriendIds()).toEqual([]);
  });

  it('getAiSuggestion() no-ops when no friends are selected', () => {
    const fixture = createComponent();
    fixture.componentInstance.getAiSuggestion();
    expect(restaurantServiceSpy.groupRecommendation).not.toHaveBeenCalled();
  });

  it('getAiSuggestion() sets restaurantId and the suggestion on success, adding a restaurant not already in the list', () => {
    restaurantServiceSpy.groupRecommendation.and.returnValue(
      of({ restaurant: makeRestaurantDetail(99), reason: 'Everyone loves BBQ', aiPowered: true }),
    );

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.toggleFriendSelection(9);
    page.getAiSuggestion();

    expect(page.restaurantId).toBe(99);
    expect(page.restaurants().some((r) => r.id === 99)).toBeTrue();
    expect(page.aiSuggestion()).toEqual({ restaurantName: 'Restaurant 99', reason: 'Everyone loves BBQ', aiPowered: true });
    expect(page.aiSuggesting()).toBeFalse();
  });

  it('getAiSuggestion() sets aiError and clears aiSuggesting on failure', () => {
    restaurantServiceSpy.groupRecommendation.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.toggleFriendSelection(9);
    page.getAiSuggestion();

    expect(page.aiError()).toContain("Couldn't get a suggestion");
    expect(page.aiSuggesting()).toBeFalse();
  });

  it('submit() shows a validation message instead of calling create() when restaurant/date/time are missing', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.date = '';
    page.submit();

    expect(tableServiceSpy.create).not.toHaveBeenCalled();
    expect(page.errorMessage()).toContain('pick a restaurant');
  });

  it('submit() creates the table and navigates to the guest list on success', () => {
    tableServiceSpy.create.and.returnValue(of({ table: { id: 42 } as unknown as DiningTable }));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    page.date = '2026-10-01';
    page.time = '19:00';
    page.visibility = true;
    page.audience = 'women_only';
    page.submit();

    expect(tableServiceSpy.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ dateTime: '2026-10-01T19:00', visibility: 'public', audience: 'women_only' }),
    );
    expect(navigateSpy).toHaveBeenCalledWith('/guest-list/42');
  });

  it('submit() invites the selected people after creating the table, then navigates to the guest list', () => {
    tableServiceSpy.create.and.returnValue(of({ table: { id: 42 } as unknown as DiningTable }));
    tableServiceSpy.invite.and.returnValue(of({ invited: [9, 20] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    page.date = '2026-10-01';
    page.time = '19:00';
    page.toggleInvitee(9);
    page.toggleInvitee(20);
    page.submit();

    expect(tableServiceSpy.invite).toHaveBeenCalledWith(42, [9, 20]);
    expect(navigateSpy).toHaveBeenCalledWith('/guest-list/42');
  });

  it('submit() still navigates to the guest list if sending invites fails', () => {
    tableServiceSpy.create.and.returnValue(of({ table: { id: 42 } as unknown as DiningTable }));
    tableServiceSpy.invite.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    page.date = '2026-10-01';
    page.time = '19:00';
    page.toggleInvitee(9);
    page.submit();

    expect(navigateSpy).toHaveBeenCalledWith('/guest-list/42');
  });

  it('submit() forces audience to "everyone" for a private table regardless of the selected audience', () => {
    tableServiceSpy.create.and.returnValue(of({ table: { id: 42 } as unknown as DiningTable }));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.date = '2026-10-01';
    page.time = '19:00';
    page.visibility = false;
    page.audience = 'women_only';
    page.submit();

    expect(tableServiceSpy.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ visibility: 'private', audience: 'everyone' }),
    );
  });

  it('submit() shows an error and resets submitting on failure', () => {
    tableServiceSpy.create.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.date = '2026-10-01';
    page.time = '19:00';
    page.submit();

    expect(page.submitting()).toBeFalse();
    expect(page.errorMessage()).toContain('Could not create the table');
  });
});
