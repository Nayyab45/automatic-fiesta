import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DiscoverRestaurantsPage } from './discover-restaurants.page';
import { Restaurant, RestaurantService } from '../../services/restaurant.service';
import { LocationService } from '../../services/location.service';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';

function makeRestaurant(id: number, overrides: Partial<Restaurant> = {}): Restaurant {
  return { id, name: `Restaurant ${id}`, city: 'Karachi', region: 'Sindh', cuisineTags: 'BBQ', rating: 4.5 } as unknown as Restaurant;
}

describe('DiscoverRestaurantsPage', () => {
  let restaurantServiceSpy: jasmine.SpyObj<RestaurantService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let profileServiceSpy: jasmine.SpyObj<ProfileService>;

  function fakeRoute(queryParams: Record<string, string> = {}) {
    return {
      snapshot: { queryParamMap: convertToParamMap(queryParams), paramMap: convertToParamMap({}) },
      paramMap: of(convertToParamMap({})),
    } as unknown as ActivatedRoute;
  }

  function createComponent(queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [DiscoverRestaurantsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(queryParams) },
        { provide: RestaurantService, useValue: restaurantServiceSpy },
        // Unused by this page directly -- its <app-user-avatar> child
        // component calls AuthService/ProfileService in its own constructor,
        // which TestBed.createComponent() runs eagerly.
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ProfileService, useValue: profileServiceSpy },
      ],
    });
    const fixture = TestBed.createComponent(DiscoverRestaurantsPage);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    restaurantServiceSpy = jasmine.createSpyObj('RestaurantService', ['cuisines', 'list', 'save', 'unsave']);
    restaurantServiceSpy.cuisines.and.returnValue(of({ cuisines: ['BBQ', 'Karahi'] }));
    restaurantServiceSpy.list.and.returnValue(of({ restaurants: [makeRestaurant(1), makeRestaurant(2)] }));

    authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    authServiceSpy.currentUser.and.returnValue({ name: 'Sam Ali' } as never);
    profileServiceSpy = jasmine.createSpyObj('ProfileService', ['me']);
    profileServiceSpy.me.and.returnValue(
      of({ profile: { photoUrl: null, name: 'Sam Ali' } }) as unknown as ReturnType<typeof profileServiceSpy.me>,
    );
  });

  it('loads cuisine chips alongside the static province chips', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.regionChips()).toEqual(['All', 'Punjab', 'Sindh', 'KPK', 'BBQ', 'Karahi']);
  });

  it('loads restaurants for the current city by default', () => {
    const fixture = createComponent();
    expect(restaurantServiceSpy.list).toHaveBeenCalledWith(
      jasmine.objectContaining({ city: TestBed.inject(LocationService).current(), region: undefined, cuisine: undefined }),
    );
    expect(fixture.componentInstance.restaurants().length).toBe(2);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('reads cuisine, priceTier, minRating, and query from the initial query params', () => {
    const fixture = createComponent({ cuisine: 'BBQ', priceTier: '2', minRating: '4', query: 'kolachi' });
    const page = fixture.componentInstance;

    expect(page.selectedRegion).toBe('BBQ');
    expect(page.selectedPriceTier).toBe(2);
    expect(page.searchQuery()).toBe('kolachi');
    expect(restaurantServiceSpy.list).toHaveBeenCalledWith(
      jasmine.objectContaining({ cuisine: 'BBQ', priceTier: 2, minRating: 4, query: 'kolachi' }),
    );
  });

  it('selectRegion() with a province chip filters by region across the whole city list, not by cuisine', () => {
    const fixture = createComponent();
    restaurantServiceSpy.list.calls.reset();

    fixture.componentInstance.selectRegion('Punjab');

    expect(restaurantServiceSpy.list).toHaveBeenCalledWith(
      jasmine.objectContaining({ city: undefined, region: 'Punjab', cuisine: undefined }),
    );
  });

  it('selectRegion() with a cuisine chip filters by cuisine within the current city', () => {
    const fixture = createComponent();
    restaurantServiceSpy.list.calls.reset();

    fixture.componentInstance.selectRegion('BBQ');

    expect(restaurantServiceSpy.list).toHaveBeenCalledWith(
      jasmine.objectContaining({ city: TestBed.inject(LocationService).current(), region: undefined, cuisine: 'BBQ' }),
    );
  });

  it('selectPriceTier() toggles the same tier off when clicked twice', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.selectPriceTier(2);
    expect(page.selectedPriceTier).toBe(2);

    page.selectPriceTier(2);
    expect(page.selectedPriceTier).toBeNull();
  });

  it('clearSearch() clears the query and reloads', () => {
    const fixture = createComponent({ query: 'kolachi' });
    restaurantServiceSpy.list.calls.reset();

    fixture.componentInstance.clearSearch();

    expect(fixture.componentInstance.searchQuery()).toBeNull();
    expect(restaurantServiceSpy.list).toHaveBeenCalledWith(jasmine.objectContaining({ query: undefined }));
  });

  it('stops loading (without crashing) when the restaurant list request fails', () => {
    restaurantServiceSpy.list.and.returnValue(throwError(() => new Error('down')));
    const fixture = createComponent();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('popularDishNames() maps dishes to names, and handles a restaurant with none', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    const withDishes = { ...makeRestaurant(1), dishes: [{ name: 'Biryani' }, { name: 'Karahi' }] } as unknown as Restaurant;
    const withoutDishes = makeRestaurant(2);

    expect(page.popularDishNames(withDishes)).toEqual(['Biryani', 'Karahi']);
    expect(page.popularDishNames(withoutDishes)).toEqual([]);
  });

  it('isSaved()/toggleSave() adds a restaurant to the saved set on save, and removes it on unsave', () => {
    restaurantServiceSpy.save.and.returnValue(of({ saved: true }));
    restaurantServiceSpy.unsave.and.returnValue(of({ saved: false }));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    const restaurant = makeRestaurant(1);

    expect(page.isSaved(1)).toBeFalse();

    page.toggleSave(restaurant);
    expect(restaurantServiceSpy.save).toHaveBeenCalledWith(1);
    expect(page.isSaved(1)).toBeTrue();

    page.toggleSave(restaurant);
    expect(restaurantServiceSpy.unsave).toHaveBeenCalledWith(1);
    expect(page.isSaved(1)).toBeFalse();
  });
});
