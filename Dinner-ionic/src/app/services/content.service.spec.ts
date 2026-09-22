import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ContentService } from './content.service';
import { environment } from '../../environments/environment';

describe('ContentService', () => {
  let service: ContentService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/content`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('get() GETs /content/:slug', () => {
    service.get('privacy-policy').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/privacy-policy`);
    expect(req.request.method).toBe('GET');
    req.flush({ content: null, updatedAt: null });
  });

  it('save() PUTs the content wrapped in a { content } body', () => {
    const content = { intro: 'x', sections: [{ heading: 'A', body: 'B' }] };
    service.save('community-guidelines', content).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/community-guidelines`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ content });
    req.flush({ content });
  });

  it('reset() DELETEs /content/:slug', () => {
    service.reset('privacy-policy').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/privacy-policy`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
