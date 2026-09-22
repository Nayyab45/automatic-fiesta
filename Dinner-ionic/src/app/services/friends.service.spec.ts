import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FriendsService } from './friends.service';
import { environment } from '../../environments/environment';

describe('FriendsService', () => {
  let service: FriendsService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/friends`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FriendsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('status() GETs /friends/status/:userId', () => {
    service.status(9).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/status/9`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'none' });
  });

  it('list() GETs /friends', () => {
    service.list().subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush({ friends: [] });
  });

  it('requests() GETs /friends/requests', () => {
    service.requests().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/requests`);
    expect(req.request.method).toBe('GET');
    req.flush({ requests: [] });
  });

  it('send() POSTs the recipientId', () => {
    service.send(9).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ recipientId: 9 });
    req.flush({ status: 'pending_sent', requestId: 1 });
  });

  it('accept() POSTs to /friends/requests/:id/accept', () => {
    service.accept(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/requests/1/accept`);
    expect(req.request.method).toBe('POST');
    req.flush({ status: 'friends' });
  });

  it('decline() POSTs to /friends/requests/:id/decline', () => {
    service.decline(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/requests/1/decline`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('unfriend() DELETEs /friends/:userId', () => {
    service.unfriend(9).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
