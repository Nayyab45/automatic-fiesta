import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminService } from './admin.service';
import { environment } from '../../environments/environment';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('stats() GETs /auth/admin/stats', () => {
    service.stats().subscribe();
    const req = httpMock.expectOne(`${api}/auth/admin/stats`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  describe('users()', () => {
    it('sends no query params when search and status are empty', () => {
      service.users('', '').subscribe();
      const req = httpMock.expectOne(`${api}/auth/admin/users`);
      expect(req.request.params.keys().length).toBe(0);
      req.flush({ users: [] });
    });

    it('sends search and status as query params when given', () => {
      service.users('sam', 'suspended').subscribe();
      const req = httpMock.expectOne(
        (r) => r.url === `${api}/auth/admin/users` && r.params.get('search') === 'sam' && r.params.get('status') === 'suspended',
      );
      req.flush({ users: [] });
    });
  });

  it('user() GETs /auth/admin/users/:id', () => {
    service.user(7).subscribe();
    const req = httpMock.expectOne(`${api}/auth/admin/users/7`);
    expect(req.request.method).toBe('GET');
    req.flush({ user: {} });
  });

  it('userReports() GETs /auth/admin/users/:id/reports', () => {
    service.userReports(7).subscribe();
    const req = httpMock.expectOne(`${api}/auth/admin/users/7/reports`);
    expect(req.request.method).toBe('GET');
    req.flush({ reports: [] });
  });

  it('suspend() POSTs the reason', () => {
    service.suspend(7, 'spam').subscribe();
    const req = httpMock.expectOne(`${api}/auth/admin/users/7/suspend`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'spam' });
    req.flush({});
  });

  it('unsuspend() POSTs to /auth/admin/users/:id/unsuspend', () => {
    service.unsuspend(7).subscribe();
    const req = httpMock.expectOne(`${api}/auth/admin/users/7/unsuspend`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('tables() GETs /tables/admin', () => {
    service.tables().subscribe();
    const req = httpMock.expectOne(`${api}/tables/admin`);
    expect(req.request.method).toBe('GET');
    req.flush({ tables: [] });
  });

  it('deleteTable() DELETEs /tables/admin/:id', () => {
    service.deleteTable(2).subscribe();
    const req = httpMock.expectOne(`${api}/tables/admin/2`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  describe('restaurants()', () => {
    it('sends no query param when search is empty', () => {
      service.restaurants('').subscribe();
      const req = httpMock.expectOne(`${api}/restaurants/admin`);
      expect(req.request.params.keys().length).toBe(0);
      req.flush({ restaurants: [] });
    });

    it('sends the search term as a query param', () => {
      service.restaurants('kolachi').subscribe();
      const req = httpMock.expectOne((r) => r.url === `${api}/restaurants/admin` && r.params.get('search') === 'kolachi');
      req.flush({ restaurants: [] });
    });
  });

  it('createRestaurant() POSTs the payload', () => {
    const payload = { name: 'X', city: 'Lahore', cuisineTags: 'BBQ' };
    service.createRestaurant(payload).subscribe();
    const req = httpMock.expectOne(`${api}/restaurants/admin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('updateRestaurant() PUTs the payload to /restaurants/admin/:id', () => {
    const payload = { name: 'X', city: 'Lahore', cuisineTags: 'BBQ' };
    service.updateRestaurant(4, payload).subscribe();
    const req = httpMock.expectOne(`${api}/restaurants/admin/4`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('deleteRestaurant() DELETEs /restaurants/admin/:id', () => {
    service.deleteRestaurant(4).subscribe();
    const req = httpMock.expectOne(`${api}/restaurants/admin/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('restaurantReviews() GETs /restaurants/admin/reviews', () => {
    service.restaurantReviews().subscribe();
    const req = httpMock.expectOne(`${api}/restaurants/admin/reviews`);
    expect(req.request.method).toBe('GET');
    req.flush({ reviews: [] });
  });

  it('deleteRestaurantReview() DELETEs /restaurants/admin/reviews/:id', () => {
    service.deleteRestaurantReview(9).subscribe();
    const req = httpMock.expectOne(`${api}/restaurants/admin/reviews/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('tableReviews() GETs /tables/admin/reviews', () => {
    service.tableReviews().subscribe();
    const req = httpMock.expectOne(`${api}/tables/admin/reviews`);
    expect(req.request.method).toBe('GET');
    req.flush({ reviews: [] });
  });

  it('deleteTableReview() DELETEs /tables/admin/reviews/:id', () => {
    service.deleteTableReview(9).subscribe();
    const req = httpMock.expectOne(`${api}/tables/admin/reviews/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
