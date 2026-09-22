import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminVerificationsPage } from './admin-verifications.page';
import { PendingVerification, VerificationService } from '../../services/verification.service';

const SUBMISSION: PendingVerification = {
  userId: 1,
  name: 'Sam',
  email: 'sam@example.com',
  idFrontUrl: 'front.jpg',
  idBackUrl: 'back.jpg',
  selfieUrl: 'selfie.jpg',
  submittedAt: new Date().toISOString(),
};

describe('AdminVerificationsPage', () => {
  let verificationServiceSpy: jasmine.SpyObj<VerificationService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AdminVerificationsPage],
      providers: [provideRouter([]), { provide: VerificationService, useValue: verificationServiceSpy }],
    });
    return TestBed.createComponent(AdminVerificationsPage);
  }

  beforeEach(() => {
    verificationServiceSpy = jasmine.createSpyObj('VerificationService', ['pending', 'decide']);
    verificationServiceSpy.pending.and.returnValue(of({ submissions: [SUBMISSION] }));
  });

  it('loads pending verification submissions', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.submissions()).toEqual([SUBMISSION]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('marks the page forbidden on a 403', () => {
    verificationServiceSpy.pending.and.returnValue(throwError(() => ({ status: 403 })));
    const fixture = createComponent();
    expect(fixture.componentInstance.forbidden()).toBeTrue();
  });

  it('decide() approving removes the submission from the queue', () => {
    verificationServiceSpy.decide.and.returnValue(of({ status: 'approved', hasIdFront: true, hasIdBack: true, hasSelfie: true, submittedAt: null, faceMatchConfidence: null }));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.decide(SUBMISSION, 'approved');

    expect(verificationServiceSpy.decide).toHaveBeenCalledWith(1, 'approved');
    expect(page.submissions()).toEqual([]);
    expect(page.decidingUserId()).toBeNull();
  });

  it('decide() rejecting also removes it from the queue', () => {
    verificationServiceSpy.decide.and.returnValue(of({ status: 'approved', hasIdFront: true, hasIdBack: true, hasSelfie: true, submittedAt: null, faceMatchConfidence: null }));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.decide(SUBMISSION, 'rejected');

    expect(verificationServiceSpy.decide).toHaveBeenCalledWith(1, 'rejected');
    expect(page.submissions()).toEqual([]);
  });

  it('decide() ignores a second call while one is already in flight', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.decidingUserId.set(1);

    page.decide(SUBMISSION, 'approved');

    expect(verificationServiceSpy.decide).not.toHaveBeenCalled();
  });

  it('decide() clears decidingUserId (without crashing) on failure', () => {
    verificationServiceSpy.decide.and.returnValue(throwError(() => new Error('down')));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.decide(SUBMISSION, 'approved');

    expect(page.decidingUserId()).toBeNull();
    expect(page.submissions()).toEqual([SUBMISSION]);
  });
});
