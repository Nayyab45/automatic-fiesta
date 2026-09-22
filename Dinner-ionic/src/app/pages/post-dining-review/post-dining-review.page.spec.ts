import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PostDiningReviewPage } from './post-dining-review.page';
import { DiningTableService, RateablePerson } from '../../services/dining-table.service';

function makePerson(overrides: Partial<RateablePerson> = {}): RateablePerson {
  return { id: 1, name: 'Bilal', photoUrl: null, myRating: null, ...overrides };
}

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('PostDiningReviewPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent(id: string | null = '5') {
    TestBed.configureTestingModule({
      imports: [PostDiningReviewPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(PostDiningReviewPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['rateablePeople', 'submitReview', 'ratePerson']);
    tableServiceSpy.rateablePeople.and.returnValue(of({ people: [] }));
    tableServiceSpy.submitReview.and.returnValue(of({}));
  });

  it('seeds peopleRatings from any rating already on file, leaving unrated people out', () => {
    tableServiceSpy.rateablePeople.and.returnValue(
      of({ people: [makePerson({ id: 1, myRating: 4 }), makePerson({ id: 2, myRating: null })] }),
    );

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.ratingFor(1)).toBe(4);
    expect(page.ratingFor(2)).toBe(0);
  });

  it('ratePerson() updates just that one person\'s rating', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.ratePerson(3, 5);
    expect(page.ratingFor(3)).toBe(5);
  });

  it('submit() sends the review plus only the ratings actually set, then navigates to /my-tables', () => {
    tableServiceSpy.rateablePeople.and.returnValue(of({ people: [makePerson({ id: 1 }), makePerson({ id: 2 })] }));
    tableServiceSpy.ratePerson.and.returnValue(of({}));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    page.foodRating.set(5);
    page.overallRating.set(4);
    page.ratePerson(1, 5);
    page.submit();

    expect(tableServiceSpy.submitReview).toHaveBeenCalledWith(
      '5',
      jasmine.objectContaining({ foodRating: 5, overallRating: 4 }),
    );
    expect(tableServiceSpy.ratePerson).toHaveBeenCalledWith('5', 1, 5);
    expect(tableServiceSpy.ratePerson).not.toHaveBeenCalledWith('5', 2, jasmine.anything());
    expect(navigateSpy).toHaveBeenCalledWith('/my-tables');
  });

  it('submit() still navigates to /my-tables even if the review request fails', () => {
    tableServiceSpy.submitReview.and.returnValue(throwError(() => new Error('down')));

    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    fixture.componentInstance.submit();

    expect(navigateSpy).toHaveBeenCalledWith('/my-tables');
  });

  it('submit() with no route id just navigates away without calling the service', () => {
    const fixture = createComponent(null);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    fixture.componentInstance.submit();

    expect(tableServiceSpy.submitReview).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/my-tables');
  });
});
