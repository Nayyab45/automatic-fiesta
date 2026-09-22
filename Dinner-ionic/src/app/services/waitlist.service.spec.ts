import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { WaitlistService } from './waitlist.service';
import { environment } from '../../environments/environment';

describe('WaitlistService', () => {
  let service: WaitlistService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WaitlistService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('join() POSTs the email to /waitlist', () => {
    service.join('sam@example.com').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/waitlist`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'sam@example.com' });
    req.flush({ ok: true });
  });
});
