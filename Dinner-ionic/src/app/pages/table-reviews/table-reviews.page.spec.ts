import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TableReviewsPage } from './table-reviews.page';
import { DiningTable, DiningTableService, Review } from '../../services/dining-table.service';

const TABLE = { id: 5, title: 'Dinner' } as unknown as DiningTable;

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 1,
    tableId: 5,
    reviewerUserId: 1,
    reviewerName: 'Sam',
    foodRating: 5,
    restaurantRating: 5,
    conversationRating: 5,
    overallRating: 4,
    dineAgain: 'yes',
    comment: 'Great!',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('TableReviewsPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent(id: string | null = '5') {
    TestBed.configureTestingModule({
      imports: [TableReviewsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id) },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(TableReviewsPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['get', 'reviews']);
    tableServiceSpy.get.and.returnValue(of({ table: TABLE }));
    tableServiceSpy.reviews.and.returnValue(of({ reviews: [] }));
  });

  it('computes the average overall rating, rounded to 1 decimal', () => {
    tableServiceSpy.reviews.and.returnValue(of({ reviews: [makeReview({ overallRating: 5 }), makeReview({ overallRating: 4 })] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.reviews().length).toBe(2);
    expect(page.averageRating()).toBe(4.5);
    expect(page.loading()).toBeFalse();
  });

  it('averageRating is null when there are no reviews yet', () => {
    tableServiceSpy.reviews.and.returnValue(of({ reviews: [] }));
    const fixture = createComponent();
    expect(fixture.componentInstance.averageRating()).toBeNull();
  });

  it('marks the page forbidden (not just empty) on a 403, distinct from no reviews', () => {
    tableServiceSpy.reviews.and.returnValue(throwError(() => ({ status: 403 })));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.forbidden()).toBeTrue();
    expect(page.loading()).toBeFalse();
  });

  it('a non-403 failure does not set forbidden', () => {
    tableServiceSpy.reviews.and.returnValue(throwError(() => ({ status: 500 })));

    const fixture = createComponent();
    expect(fixture.componentInstance.forbidden()).toBeFalse();
  });

  it('dineAgainLabel() maps each value to its display text, and unknown values to an empty string', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    expect(page.dineAgainLabel('yes')).toBe('Would dine again');
    expect(page.dineAgainLabel('maybe')).toBe('Might dine again');
    expect(page.dineAgainLabel('no')).toBe("Wouldn't dine again");
    expect(page.dineAgainLabel('')).toBe('');
  });
});
