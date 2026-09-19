import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { RestaurantService, googleMapsUrl, staticMapUrl } from './restaurant.service';
import { environment } from '../../environments/environment';

describe('googleMapsUrl', () => {
  it('prefers coordinates when both latitude and longitude are known', () => {
    expect(googleMapsUrl({ latitude: 31.5, longitude: 74.3, address: '123 Main St' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=31.5,74.3',
    );
  });

  it('falls back to a text search by address when there are no coordinates', () => {
    expect(googleMapsUrl({ address: '123 Main St, Lahore' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Lahore',
    );
  });

  it('falls back to the restaurant name when neither coordinates nor address are known', () => {
    expect(googleMapsUrl({ name: 'Cafe Aylanto' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=Cafe%20Aylanto',
    );
  });

  it('only uses coordinates when both latitude AND longitude are present', () => {
    expect(googleMapsUrl({ latitude: 31.5, address: 'Fallback Ave' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=Fallback%20Ave',
    );
  });
});

describe('staticMapUrl', () => {
  it('builds a Wikimedia Kartotherian URL with the given size and zoom', () => {
    expect(staticMapUrl(31.5, 74.3, 300, 150, 14)).toBe(
      'https://maps.wikimedia.org/img/osm-intl,14,31.5,74.3,300x150.png',
    );
  });

  it('defaults width/height/zoom when not given', () => {
    expect(staticMapUrl(31.5, 74.3)).toBe('https://maps.wikimedia.org/img/osm-intl,16,31.5,74.3,400x200.png');
  });
});

describe('RestaurantService', () => {
  let service: RestaurantService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/restaurants`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RestaurantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() sends only the filters that were actually provided', () => {
    service.list({ city: 'Lahore', minRating: 4 }).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === baseUrl && r.params.get('city') === 'Lahore' && r.params.get('minRating') === '4',
    );
    expect(req.request.params.has('region')).toBeFalse();
    req.flush({ restaurants: [] });
  });

  it('list() times out if the backend never responds', fakeAsync(() => {
    let error: unknown;
    service.list().subscribe({ error: (err) => (error = err) });

    const req = httpMock.expectOne(baseUrl);
    tick(20000);

    expect(error).toBeTruthy();
    // rxjs's timeout() unsubscribes from the still-pending HTTP request once
    // it errors, which HttpClientTestingController reports as cancelled.
    expect(req.cancelled).toBeTruthy();
  }));

  it('cuisines() only sets ?city when one is passed', () => {
    service.cuisines().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/cuisines`);
    expect(req.request.params.has('city')).toBeFalse();
    req.flush({ cuisines: [] });

    service.cuisines('Karachi').subscribe();
    const reqWithCity = httpMock.expectOne((r) => r.url === `${baseUrl}/cuisines` && r.params.get('city') === 'Karachi');
    reqWithCity.flush({ cuisines: [] });
  });

  it('get(id) GETs /restaurants/:id', () => {
    service.get(7).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/7`);
    expect(req.request.method).toBe('GET');
    req.flush({ restaurant: { id: 7, dishes: [] } });
  });

  it('recommended() only sets lat/lng when coords are passed', () => {
    service.recommended().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/recommended`);
    expect(req.request.params.has('lat')).toBeFalse();
    req.flush({ restaurants: [] });

    service.recommended({ lat: 31.5, lng: 74.3 }).subscribe();
    const reqWithCoords = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/recommended` && r.params.get('lat') === '31.5' && r.params.get('lng') === '74.3',
    );
    reqWithCoords.flush({ restaurants: [] });
  });

  it('groupRecommendation() POSTs memberIds in the body and city as a query param', () => {
    service.groupRecommendation([2, 3], 'Lahore').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/group-recommendation` && r.params.get('city') === 'Lahore');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ memberIds: [2, 3] });
    req.flush({ restaurant: {}, reason: '', aiPowered: false });
  });

  it('save()/unsave() hit the same :id/save resource with different verbs', () => {
    service.save(5).subscribe();
    const saveReq = httpMock.expectOne(`${baseUrl}/5/save`);
    expect(saveReq.request.method).toBe('POST');
    saveReq.flush({ saved: true });

    service.unsave(5).subscribe();
    const unsaveReq = httpMock.expectOne(`${baseUrl}/5/save`);
    expect(unsaveReq.request.method).toBe('DELETE');
    unsaveReq.flush({ saved: false });
  });

  it('submitReview() POSTs rating/comment to :id/reviews', () => {
    service.submitReview(5, { rating: 5, comment: 'Loved it' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/5/reviews`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ rating: 5, comment: 'Loved it' });
    req.flush({ review: {} });
  });

  it('deleteReview() DELETEs :id/reviews', () => {
    service.deleteReview(5).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/5/reviews`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: true });
  });
});
