import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AiRestaurantRecommendationPage } from './ai-restaurant-recommendation.page';
import { RestaurantDetail, RestaurantService } from '../../services/restaurant.service';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';

function makeRestaurant(overrides: Partial<RestaurantDetail> = {}): RestaurantDetail {
  return {
    id: 1,
    name: 'Kolachi',
    city: 'Karachi',
    cuisineTags: 'BBQ,Pakistani',
    priceTier: 2,
    rating: 4.5,
    reasons: undefined,
    dishes: [],
    ...overrides,
  } as unknown as RestaurantDetail;
}

describe('AiRestaurantRecommendationPage', () => {
  let restaurantServiceSpy: jasmine.SpyObj<RestaurantService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let profileServiceSpy: jasmine.SpyObj<ProfileService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AiRestaurantRecommendationPage],
      providers: [
        provideRouter([]),
        { provide: RestaurantService, useValue: restaurantServiceSpy },
        // Unused by this page directly -- its <app-user-avatar> child
        // component calls these in its own constructor, which runs eagerly.
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ProfileService, useValue: profileServiceSpy },
      ],
    });
    const fixture = TestBed.createComponent(AiRestaurantRecommendationPage);
    // loadRecommendation() awaits a Geolocation call (stubbed below) before
    // subscribing -- flush() drains that promise microtask deterministically,
    // unlike whenStable(), which doesn't reliably track a bare Promise chain
    // that isn't itself an Angular/zone-scheduled task. flush() (not tick())
    // because the Capacitor plugin proxy's lazy `import()` of its web
    // implementation leaves a timer queued on whichever test first triggers
    // it -- tick() only advances to the current instant and fakeAsync then
    // complains that timer is still pending; flush() runs the queue empty.
    flush();
    return fixture;
  }

  beforeEach(() => {
    // @capacitor/geolocation's web fallback is a thin wrapper over the
    // browser's own navigator.geolocation.getCurrentPosition -- spying on
    // the Capacitor plugin object itself doesn't work (registerPlugin()
    // returns a proxy that a plain spyOn override doesn't stick to), and
    // real navigator.geolocation in headless Chrome (no permission, no user
    // gesture) doesn't reject promptly enough for a test to wait on. Spying
    // on the actual browser API it calls into is both the layer that's
    // spyable and the one that determines the real timing.
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(
      (_success: PositionCallback, error?: PositionErrorCallback | null) =>
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError),
    );
    restaurantServiceSpy = jasmine.createSpyObj('RestaurantService', ['recommended']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    authServiceSpy.currentUser.and.returnValue({ name: 'Sam Ali' } as never);
    profileServiceSpy = jasmine.createSpyObj('ProfileService', ['me']);
    profileServiceSpy.me.and.returnValue(
      of({ profile: { photoUrl: null, name: 'Sam Ali' } }) as unknown as ReturnType<typeof profileServiceSpy.me>,
    );
  });

  it('loads the top recommended restaurant and stops loading', fakeAsync(() => {
    restaurantServiceSpy.recommended.and.returnValue(of({ restaurants: [makeRestaurant()] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.recommendation()?.name).toBe('Kolachi');
    expect(page.loading()).toBeFalse();
  }));

  it('sets recommendation to null when nothing comes back', fakeAsync(() => {
    restaurantServiceSpy.recommended.and.returnValue(of({ restaurants: [] }));
    const fixture = createComponent();
    expect(fixture.componentInstance.recommendation()).toBeNull();
  }));

  it('cuisineTags splits the comma-separated string', fakeAsync(() => {
    restaurantServiceSpy.recommended.and.returnValue(of({ restaurants: [makeRestaurant({ cuisineTags: 'BBQ,Karahi,Biryani' })] }));
    const fixture = createComponent();
    expect(fixture.componentInstance.cuisineTags()).toEqual(['BBQ', 'Karahi', 'Biryani']);
  }));

  it('prefers server-generated reasons when present', fakeAsync(() => {
    restaurantServiceSpy.recommended.and.returnValue(
      of({ restaurants: [makeRestaurant({ reasons: ['Matches your taste', 'Close by'] })] }),
    );
    const fixture = createComponent();
    expect(fixture.componentInstance.reasons()).toEqual(['Matches your taste', 'Close by']);
  }));

  it('falls back to heuristic reasons when the server sent none', fakeAsync(() => {
    restaurantServiceSpy.recommended.and.returnValue(
      of({ restaurants: [makeRestaurant({ reasons: undefined, rating: 4.9, priceTier: 4, city: 'Karachi', cuisineTags: 'BBQ,Karahi' })] }),
    );
    const fixture = createComponent();
    const reasons = fixture.componentInstance.reasons();
    expect(reasons).toContain('Top rated in Karachi');
    expect(reasons).toContain('Known for BBQ');
    expect(reasons).toContain('Great for a special occasion');
  }));

  it('reasons is empty before anything has loaded', fakeAsync(() => {
    restaurantServiceSpy.recommended.and.returnValue(throwError(() => new Error('down')));
    const fixture = createComponent();
    expect(fixture.componentInstance.reasons()).toEqual([]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  }));

  it('viewRestaurant() navigates to the restaurant detail page', fakeAsync(() => {
    restaurantServiceSpy.recommended.and.returnValue(of({ restaurants: [makeRestaurant({ id: 42 })] }));
    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    fixture.componentInstance.viewRestaurant();

    expect(navigateSpy).toHaveBeenCalledWith('/restaurant-detail/42');
  }));

  it('viewRestaurant() does nothing when there is no recommendation yet', fakeAsync(() => {
    restaurantServiceSpy.recommended.and.returnValue(of({ restaurants: [] }));
    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    fixture.componentInstance.viewRestaurant();

    expect(navigateSpy).not.toHaveBeenCalled();
  }));
});
