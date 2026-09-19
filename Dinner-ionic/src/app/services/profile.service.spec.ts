import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ProfileService } from './profile.service';
import { environment } from '../../environments/environment';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/profile`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('me() GETs /profile/me', () => {
    let result: unknown;
    service.me().subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/me`);
    expect(req.request.method).toBe('GET');
    const payload = { profile: { id: 1 }, isAdmin: false };
    req.flush(payload);

    expect(result).toEqual(payload as never);
  });

  it('get(id) GETs /profile/:id', () => {
    service.get(42).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/42`);
    expect(req.request.method).toBe('GET');
    req.flush({ profile: { id: 42 } });
  });

  it('updateMe() PUTs only the fields it was given', () => {
    service.updateMe({ city: 'Lahore', bio: 'Foodie' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/me`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ city: 'Lahore', bio: 'Foodie' });
    req.flush({ profile: {} });
  });

  it('setInterests() PUTs the interest ids', () => {
    service.setInterests([1, 2, 3]).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/me/interests`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ interestIds: [1, 2, 3] });
    req.flush({ interests: [] });
  });

  it('interests() GETs the top-level /interests endpoint, not /profile/interests', () => {
    service.interests().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/interests`);
    expect(req.request.method).toBe('GET');
    req.flush({ interests: [] });
  });

  it('privacySettings() GETs and updatePrivacySettings() PUTs the same resource', () => {
    service.privacySettings().subscribe();
    httpMock.expectOne(`${baseUrl}/me/privacy-settings`).flush({ settings: {} });

    service.updatePrivacySettings({ showOnlineStatus: false }).subscribe();
    const putReq = httpMock.expectOne(`${baseUrl}/me/privacy-settings`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ showOnlineStatus: false });
    putReq.flush({ settings: {} });
  });

  describe('people()', () => {
    it('sends no query params when called with no filters', () => {
      service.people().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/people`);
      expect(req.request.params.keys().length).toBe(0);
      req.flush({ people: [] });
    });

    it('joins interestIds and cuisine arrays into comma-separated params', () => {
      service.people({ interestIds: [1, 2], cuisine: ['Karahi', 'BBQ'] }).subscribe();
      const req = httpMock.expectOne(
        (r) => r.url === `${environment.apiUrl}/people` && r.params.get('interestIds') === '1,2' && r.params.get('cuisine') === 'Karahi,BBQ',
      );
      expect(req.request.params.get('interestIds')).toBe('1,2');
      req.flush({ people: [] });
    });

    it('only sends lat/lng/maxDistanceKm together, when all three are present', () => {
      service.people({ lat: 31.5, lng: 74.3 }).subscribe();
      // expectOne(url) matches on the full URL including query params, so a
      // bare-path match here proves no lat/lng/maxDistanceKm were sent at all.
      const req = httpMock.expectOne(`${environment.apiUrl}/people`);
      expect(req.request.params.has('lat')).toBeFalse();
      req.flush({ people: [] });

      service.people({ lat: 31.5, lng: 74.3, maxDistanceKm: 10 }).subscribe();
      const reqWithCoords = httpMock.expectOne(
        (r) => r.url === `${environment.apiUrl}/people` && r.params.get('lat') === '31.5' && r.params.get('maxDistanceKm') === '10',
      );
      reqWithCoords.flush({ people: [] });
    });

    it('omits a zero minAge/maxAge rather than sending "0"', () => {
      service.people({ minAge: 0 }).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/people`);
      expect(req.request.params.has('minAge')).toBeFalse();
      req.flush({ people: [] });
    });
  });

  it('matches() GETs the top-level /matches endpoint', () => {
    service.matches().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/matches`);
    expect(req.request.method).toBe('GET');
    req.flush({ matches: [], aiInsightsUnlocked: false });
  });
});
