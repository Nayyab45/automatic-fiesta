import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SafetyService } from './safety.service';
import { environment } from '../../environments/environment';

describe('SafetyService', () => {
  let service: SafetyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SafetyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('emergencyContacts() GETs /emergency-contacts', () => {
    service.emergencyContacts().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/emergency-contacts`);
    expect(req.request.method).toBe('GET');
    req.flush({ contacts: [] });
  });

  it('addEmergencyContact() POSTs the payload as-is', () => {
    const payload = { name: 'Mom', phone: '0300-1234567' };
    service.addEmergencyContact(payload).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/emergency-contacts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ contact: {} });
  });

  it('removeEmergencyContact() DELETEs /emergency-contacts/:id', () => {
    service.removeEmergencyContact(3).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/emergency-contacts/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('blockedUsers() GETs /blocks', () => {
    service.blockedUsers().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/blocks`);
    expect(req.request.method).toBe('GET');
    req.flush({ blocked: [] });
  });

  it('block() POSTs the userId', () => {
    service.block(8).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/blocks`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 8 });
    req.flush({});
  });

  it('unblock() DELETEs /blocks/:userId', () => {
    service.unblock(8).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/blocks/8`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('report() POSTs reportedUserId, reason, details, and alsoBlock', () => {
    service.report(8, 'harassment', 'details here', true).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/reports`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reportedUserId: 8, reason: 'harassment', details: 'details here', alsoBlock: true });
    req.flush({});
  });
});
