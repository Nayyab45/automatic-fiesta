import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DiningTableService } from './dining-table.service';
import { environment } from '../../environments/environment';

describe('DiningTableService', () => {
  let service: DiningTableService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/tables`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DiningTableService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listMine() GETs /tables?mine=true', () => {
    service.listMine().subscribe();
    const req = httpMock.expectOne(`${baseUrl}?mine=true`);
    expect(req.request.method).toBe('GET');
    req.flush({ tables: [] });
  });

  it('discover() GETs /tables/discover', () => {
    service.discover().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/discover`);
    expect(req.request.method).toBe('GET');
    req.flush({ tables: [] });
  });

  it('get() GETs /tables/:id', () => {
    service.get(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush({ table: {} });
  });

  it('create() POSTs the payload to /tables', () => {
    const payload = { restaurantId: 1, gatheringType: 'dinner', dateTime: '2026-10-01T19:00:00Z', seatsTotal: 4 };
    service.create(payload).subscribe();
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ table: {} });
  });

  it('setBill() PATCHes totalBill to /tables/:id/bill', () => {
    service.setBill(1, 5000).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/bill`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ totalBill: 5000 });
    req.flush({ table: {} });
  });

  it('guests() GETs /tables/:id/guests', () => {
    service.guests(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/guests`);
    expect(req.request.method).toBe('GET');
    req.flush({ guests: [] });
  });

  it('requestSeat() POSTs an optional message', () => {
    service.requestSeat(1, 'Can I join?').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/seat-requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'Can I join?' });
    req.flush({ seatRequest: {} });
  });

  it('mySeatRequest() GETs /tables/:id/seat-requests/me', () => {
    service.mySeatRequest(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/seat-requests/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ seatRequest: null });
  });

  it('seatRequests() GETs /tables/:id/seat-requests', () => {
    service.seatRequests(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/seat-requests`);
    expect(req.request.method).toBe('GET');
    req.flush({ seatRequests: [] });
  });

  it('patchSeatRequest() PATCHes the status on the top-level /seat-requests/:id', () => {
    service.patchSeatRequest(9, 'confirmed').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/seat-requests/9`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'confirmed' });
    req.flush({ seatRequest: {} });
  });

  it('checkIn() POSTs to /tables/:id/check-in', () => {
    service.checkIn(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/check-in`);
    expect(req.request.method).toBe('POST');
    req.flush({ checkIn: {} });
  });

  it('checkOut() POSTs to /tables/:id/check-out', () => {
    service.checkOut(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/check-out`);
    expect(req.request.method).toBe('POST');
    req.flush({ checkIn: null });
  });

  it('myCheckIn() GETs /tables/:id/check-in/me', () => {
    service.myCheckIn(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/check-in/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ checkIn: null });
  });

  it('submitReview() POSTs the review payload', () => {
    const payload = { foodRating: 5, restaurantRating: 5, conversationRating: 5, overallRating: 5, dineAgain: 'yes', comment: 'Great!' };
    service.submitReview(1, payload).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/reviews`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('reviews() GETs /tables/:id/reviews', () => {
    service.reviews(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/reviews`);
    expect(req.request.method).toBe('GET');
    req.flush({ reviews: [] });
  });

  it('rateablePeople() GETs /tables/:id/rateable', () => {
    service.rateablePeople(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/rateable`);
    expect(req.request.method).toBe('GET');
    req.flush({ people: [] });
  });

  it('ratePerson() POSTs ratedUserId and score', () => {
    service.ratePerson(1, 5, 4).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/rate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ratedUserId: 5, score: 4 });
    req.flush({});
  });

  it('messages() GETs /tables/:id/messages', () => {
    service.messages(1).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/messages`);
    expect(req.request.method).toBe('GET');
    req.flush({ messages: [] });
  });

  it('sendMessage() POSTs the body text', () => {
    service.sendMessage(1, 'hey table!').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/1/messages`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'hey table!' });
    req.flush({ message: {} });
  });
});
