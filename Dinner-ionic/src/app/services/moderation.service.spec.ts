import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ModerationService } from './moderation.service';
import { environment } from '../../environments/environment';

describe('ModerationService', () => {
  let service: ModerationService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/blocks/admin`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ModerationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('flagged() GETs /blocks/admin/flagged', () => {
    service.flagged().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/flagged`);
    expect(req.request.method).toBe('GET');
    req.flush({ flagged: [] });
  });

  it('dismiss() POSTs to /blocks/admin/:userId/dismiss', () => {
    service.dismiss(3).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/3/dismiss`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deleteAccount() DELETEs /blocks/admin/:userId', () => {
    service.deleteAccount(3).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
