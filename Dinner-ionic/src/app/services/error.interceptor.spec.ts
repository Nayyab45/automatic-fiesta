import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ToastController } from '@ionic/angular/standalone';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let toastControllerSpy: jasmine.SpyObj<ToastController>;
  let presentSpy: jasmine.Spy;

  beforeEach(() => {
    presentSpy = jasmine.createSpy('present').and.resolveTo();
    toastControllerSpy = jasmine.createSpyObj('ToastController', ['create']);
    toastControllerSpy.create.and.resolveTo({ present: presentSpy } as unknown as HTMLIonToastElement);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastController, useValue: toastControllerSpy },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('shows a toast and still surfaces the error on a network failure (status 0)', async () => {
    let errored = false;
    http.get('/api/notifications').subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/api/notifications').flush(null, { status: 0, statusText: 'Unknown Error' });
    await Promise.resolve();

    expect(errored).toBeTrue();
    expect(toastControllerSpy.create).toHaveBeenCalled();
  });

  it('shows a toast and still surfaces the error on a 5xx server error', async () => {
    let errored = false;
    http.get('/api/notifications').subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/api/notifications').flush(null, { status: 503, statusText: 'Service Unavailable' });
    await Promise.resolve();

    expect(errored).toBeTrue();
    expect(toastControllerSpy.create).toHaveBeenCalled();
  });

  it('does not toast a 4xx error, e.g. a 404, and still surfaces it', () => {
    let errored = false;
    http.get('/api/profile/999').subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/api/profile/999').flush(null, { status: 404, statusText: 'Not Found' });

    expect(errored).toBeTrue();
    expect(toastControllerSpy.create).not.toHaveBeenCalled();
  });

  it('passes a successful response through untouched', () => {
    let result: unknown;
    http.get('/api/notifications').subscribe((r) => (result = r));

    httpMock.expectOne('/api/notifications').flush({ notifications: [] });

    expect(result).toEqual({ notifications: [] });
    expect(toastControllerSpy.create).not.toHaveBeenCalled();
  });
});
