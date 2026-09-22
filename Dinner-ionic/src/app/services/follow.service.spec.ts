import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FollowService } from './follow.service';
import { environment } from '../../environments/environment';

describe('FollowService', () => {
  let service: FollowService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/follows`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FollowService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('status() GETs /follows/status/:userId', () => {
    service.status(5).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/status/5`);
    expect(req.request.method).toBe('GET');
    req.flush({ following: true });
  });

  it('follow() POSTs to /follows/:userId', () => {
    service.follow(5).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/5`);
    expect(req.request.method).toBe('POST');
    req.flush({ following: true });
  });

  it('unfollow() DELETEs /follows/:userId', () => {
    service.unfollow(5).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ following: false });
  });

  it('removeFollower() DELETEs /follows/followers/:userId', () => {
    service.removeFollower(5).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/followers/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ removed: true });
  });

  it('followers() GETs /follows/followers', () => {
    service.followers().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/followers`);
    expect(req.request.method).toBe('GET');
    req.flush({ followers: [] });
  });

  it('following() GETs /follows/following', () => {
    service.following().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/following`);
    expect(req.request.method).toBe('GET');
    req.flush({ following: [] });
  });
});
