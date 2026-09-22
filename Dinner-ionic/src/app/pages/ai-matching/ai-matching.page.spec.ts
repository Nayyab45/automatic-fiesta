import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AiMatchingPage } from './ai-matching.page';
import { Match, ProfileService } from '../../services/profile.service';
import { AuthService } from '../../services/auth.service';

const MATCH = { id: 2, name: 'Sara', score: 90 } as unknown as Match;

describe('AiMatchingPage', () => {
  let profileServiceSpy: jasmine.SpyObj<ProfileService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AiMatchingPage],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: profileServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });
    return TestBed.createComponent(AiMatchingPage);
  }

  beforeEach(() => {
    // 'me' is unused by this page itself -- its <app-user-avatar> child
    // component calls it in its own constructor, which runs eagerly.
    profileServiceSpy = jasmine.createSpyObj('ProfileService', ['matches', 'me']);
    profileServiceSpy.me.and.returnValue(
      of({ profile: { photoUrl: null, name: 'Sam Ali' } }) as unknown as ReturnType<typeof profileServiceSpy.me>,
    );
    authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    authServiceSpy.currentUser.and.returnValue({ name: 'Sam Ali' } as never);
  });

  it('loads the full ranked match list', () => {
    profileServiceSpy.matches.and.returnValue(of({ matches: [MATCH] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.matches()).toEqual([MATCH]);
    expect(page.loading()).toBeFalse();
  });

  it('stops loading (without crashing) when the request fails', () => {
    profileServiceSpy.matches.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent();
    expect(fixture.componentInstance.matches()).toEqual([]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
