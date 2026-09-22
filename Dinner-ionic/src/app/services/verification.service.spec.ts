import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VerificationService } from './verification.service';
import { environment } from '../../environments/environment';

describe('VerificationService', () => {
  let service: VerificationService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/verification`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VerificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('status() GETs /verification/me', () => {
    service.status().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'not_started' });
  });

  it('saveId() PUTs idFrontUrl and idBackUrl', () => {
    service.saveId('front.jpg', 'back.jpg').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/me/id`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ idFrontUrl: 'front.jpg', idBackUrl: 'back.jpg' });
    req.flush({ status: 'not_started' });
  });

  it('saveSelfie() PUTs selfieUrl', () => {
    service.saveSelfie('selfie.jpg').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/me/selfie`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ selfieUrl: 'selfie.jpg' });
    req.flush({ status: 'not_started' });
  });

  it('submit() POSTs to /verification/me/submit', () => {
    service.submit().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/me/submit`);
    expect(req.request.method).toBe('POST');
    req.flush({ status: 'pending' });
  });

  it('pending() GETs /verification/admin/pending', () => {
    service.pending().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/admin/pending`);
    expect(req.request.method).toBe('GET');
    req.flush({ submissions: [] });
  });

  it('decide() PATCHes the status to /verification/admin/:userId', () => {
    service.decide(11, 'approved').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/admin/11`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'approved' });
    req.flush({ status: 'approved' });
  });
});
