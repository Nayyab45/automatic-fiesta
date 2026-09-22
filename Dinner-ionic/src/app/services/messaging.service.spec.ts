import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MessagingService } from './messaging.service';
import { environment } from '../../environments/environment';

describe('MessagingService', () => {
  let service: MessagingService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/conversations`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MessagingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() GETs /conversations', () => {
    service.list().subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush({ conversations: [] });
  });

  it('getOrCreateWith() POSTs the recipientId', () => {
    service.getOrCreateWith(42).subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ recipientId: 42 });
    req.flush({ conversation: { id: 1, person: null } });
  });

  it('get() GETs /conversations/:id', () => {
    service.get(7).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/7`);
    expect(req.request.method).toBe('GET');
    req.flush({ conversation: { id: 7, person: null } });
  });

  it('messages() GETs /conversations/:id/messages', () => {
    service.messages(7).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/7/messages`);
    expect(req.request.method).toBe('GET');
    req.flush({ messages: [] });
  });

  it('sendMessage() POSTs the body text', () => {
    service.sendMessage(7, 'hello there').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/7/messages`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'hello there' });
    req.flush({ message: {} });
  });

  it('markRead() POSTs to /conversations/:id/read', () => {
    service.markRead(7).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/7/read`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
