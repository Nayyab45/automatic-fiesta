import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminReviewsPage } from './admin-reviews.page';
import { AdminRestaurantReview, AdminService, AdminTableReview } from '../../services/admin.service';

const RESTAURANT_REVIEW: AdminRestaurantReview = {
  id: 1,
  rating: 5,
  comment: 'Great!',
  createdAt: new Date().toISOString(),
  reviewerName: 'Sam',
  restaurantName: 'Kolachi',
};

const TABLE_REVIEW: AdminTableReview = {
  id: 2,
  tableId: 5,
  tableTitle: 'Friday Dinner',
  reviewerName: 'Sara',
  overallRating: 4,
  comment: 'Fun!',
  createdAt: new Date().toISOString(),
};

describe('AdminReviewsPage', () => {
  let adminServiceSpy: jasmine.SpyObj<AdminService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AdminReviewsPage],
      providers: [provideRouter([]), { provide: AdminService, useValue: adminServiceSpy }],
    });
    return TestBed.createComponent(AdminReviewsPage);
  }

  beforeEach(() => {
    adminServiceSpy = jasmine.createSpyObj('AdminService', [
      'restaurantReviews',
      'tableReviews',
      'deleteRestaurantReview',
      'deleteTableReview',
    ]);
  });

  it('loads both restaurant and table reviews, only finishing loading once both land', () => {
    adminServiceSpy.restaurantReviews.and.returnValue(of({ reviews: [RESTAURANT_REVIEW] }));
    adminServiceSpy.tableReviews.and.returnValue(of({ reviews: [TABLE_REVIEW] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.restaurantReviews()).toEqual([RESTAURANT_REVIEW]);
    expect(page.tableReviews()).toEqual([TABLE_REVIEW]);
    expect(page.loading()).toBeFalse();
  });

  it('marks the page forbidden if either request 403s', () => {
    adminServiceSpy.restaurantReviews.and.returnValue(throwError(() => ({ status: 403 })));
    adminServiceSpy.tableReviews.and.returnValue(of({ reviews: [] }));

    const fixture = createComponent();
    expect(fixture.componentInstance.forbidden()).toBeTrue();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('defaults to the restaurant tab', () => {
    adminServiceSpy.restaurantReviews.and.returnValue(of({ reviews: [] }));
    adminServiceSpy.tableReviews.and.returnValue(of({ reviews: [] }));
    const fixture = createComponent();
    expect(fixture.componentInstance.tab()).toBe('restaurant');
  });

  it('removeRestaurantReview() does nothing without confirmation', () => {
    adminServiceSpy.restaurantReviews.and.returnValue(of({ reviews: [RESTAURANT_REVIEW] }));
    adminServiceSpy.tableReviews.and.returnValue(of({ reviews: [] }));
    spyOn(window, 'confirm').and.returnValue(false);

    const fixture = createComponent();
    fixture.componentInstance.removeRestaurantReview(RESTAURANT_REVIEW);

    expect(adminServiceSpy.deleteRestaurantReview).not.toHaveBeenCalled();
  });

  it('removeRestaurantReview() removes it from the list once confirmed', () => {
    adminServiceSpy.restaurantReviews.and.returnValue(of({ reviews: [RESTAURANT_REVIEW] }));
    adminServiceSpy.tableReviews.and.returnValue(of({ reviews: [] }));
    spyOn(window, 'confirm').and.returnValue(true);
    adminServiceSpy.deleteRestaurantReview.and.returnValue(of({}));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.removeRestaurantReview(RESTAURANT_REVIEW);

    expect(adminServiceSpy.deleteRestaurantReview).toHaveBeenCalledWith(1);
    expect(page.restaurantReviews()).toEqual([]);
  });

  it('removeTableReview() removes it from the list once confirmed', () => {
    adminServiceSpy.restaurantReviews.and.returnValue(of({ reviews: [] }));
    adminServiceSpy.tableReviews.and.returnValue(of({ reviews: [TABLE_REVIEW] }));
    spyOn(window, 'confirm').and.returnValue(true);
    adminServiceSpy.deleteTableReview.and.returnValue(of({}));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.removeTableReview(TABLE_REVIEW);

    expect(adminServiceSpy.deleteTableReview).toHaveBeenCalledWith(2);
    expect(page.tableReviews()).toEqual([]);
  });
});
