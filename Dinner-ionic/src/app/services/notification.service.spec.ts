import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { environment } from '../../environments/environment';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/notifications`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() GETs /notifications', () => {
    service.list().subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush({ notifications: [] });
  });

  it('markAllRead() POSTs to /notifications/read-all', () => {
    service.markAllRead().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/read-all`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('markRead() POSTs to /notifications/:id/read', () => {
    service.markRead(4).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/4/read`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('registerDeviceToken() POSTs the token', () => {
    service.registerDeviceToken('tok-123').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/device-token`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok-123' });
    req.flush({});
  });

  it('unregisterDeviceToken() DELETEs with the token in the request body', () => {
    service.unregisterDeviceToken('tok-123').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/device-token`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ token: 'tok-123' });
    req.flush({});
  });
});
