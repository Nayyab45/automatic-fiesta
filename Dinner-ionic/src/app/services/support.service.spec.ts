import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SupportService } from './support.service';
import { environment } from '../../environments/environment';

describe('SupportService', () => {
  let service: SupportService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/support`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SupportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('submit() POSTs subject and message to /support', () => {
    service.submit('Bug report', 'The app crashed').subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ subject: 'Bug report', message: 'The app crashed' });
    req.flush({});
  });

  it('list() GETs /support/admin', () => {
    service.list().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/admin`);
    expect(req.request.method).toBe('GET');
    req.flush({ messages: [] });
  });

  it('resolve() POSTs to /support/admin/:id/resolve', () => {
    service.resolve(6).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/admin/6/resolve`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
