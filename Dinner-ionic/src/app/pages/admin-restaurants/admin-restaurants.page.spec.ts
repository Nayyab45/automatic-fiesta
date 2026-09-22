import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AdminRestaurantsPage } from './admin-restaurants.page';
import { AdminRestaurant, AdminService } from '../../services/admin.service';
import { RestaurantDetail, RestaurantService } from '../../services/restaurant.service';

const ROW: AdminRestaurant = {
  id: 1,
  name: 'Kolachi',
  city: 'Karachi',
  region: 'Sindh',
  cuisineTags: 'BBQ',
  priceTier: 2,
  rating: 4.5,
  reviewCount: 10,
  address: null,
  source: 'osm',
  createdAt: new Date().toISOString(),
};

describe('AdminRestaurantsPage', () => {
  let adminServiceSpy: jasmine.SpyObj<AdminService>;
  let restaurantServiceSpy: jasmine.SpyObj<RestaurantService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AdminRestaurantsPage],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: adminServiceSpy },
        { provide: RestaurantService, useValue: restaurantServiceSpy },
      ],
    });
    return TestBed.createComponent(AdminRestaurantsPage);
  }

  beforeEach(() => {
    adminServiceSpy = jasmine.createSpyObj('AdminService', ['restaurants', 'createRestaurant', 'updateRestaurant', 'deleteRestaurant']);
    restaurantServiceSpy = jasmine.createSpyObj('RestaurantService', ['get']);
    adminServiceSpy.restaurants.and.returnValue(of({ restaurants: [ROW] }));
  });

  it('loads the restaurant list on construction', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.restaurants()).toEqual([ROW]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('marks the page forbidden on a 403', () => {
    adminServiceSpy.restaurants.and.returnValue(throwError(() => ({ status: 403 })));
    const fixture = createComponent();
    expect(fixture.componentInstance.forbidden()).toBeTrue();
  });

  it('openAdd() resets the form to blank and opens it', () => {
    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.form.name = 'stale value';
    page.editingId.set(5);

    page.openAdd();

    expect(page.form.name).toBe('');
    expect(page.editingId()).toBeNull();
    expect(page.formOpen()).toBeTrue();
  });

  it('openEdit() fetches the full record and fills the form from it', () => {
    const detail = {
      id: 1,
      name: 'Kolachi',
      city: 'Karachi',
      region: 'Sindh',
      cuisineTags: 'BBQ',
      priceTier: 2,
      address: '123 Do Darya',
      description: 'Riverside dining',
      photoUrl: 'photo.jpg',
      latitude: 24.8,
      longitude: 67.0,
      contactPhone: '021-111',
      contactEmail: 'info@kolachi.pk',
      website: 'kolachi.pk',
    } as unknown as RestaurantDetail;
    restaurantServiceSpy.get.and.returnValue(of({ restaurant: detail }));

    const fixture = createComponent();
    const page = fixture.componentInstance;
    page.openEdit(ROW);

    expect(restaurantServiceSpy.get).toHaveBeenCalledWith(1);
    expect(page.form.name).toBe('Kolachi');
    expect(page.form.website).toBe('kolachi.pk');
    expect(page.editingId()).toBe(1);
    expect(page.formOpen()).toBeTrue();
  });

  it('openEdit() surfaces a list error (without opening the form) on failure', () => {
    restaurantServiceSpy.get.and.returnValue(throwError(() => new Error('404')));
    const fixture = createComponent();
    const page = fixture.componentInstance;

    page.openEdit(ROW);

    expect(page.formOpen()).toBeFalse();
    expect(page.listError()).toContain("Couldn't load");
  });

  describe('save()', () => {
    it('rejects saving without name, city, or cuisine tags', () => {
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.form.name = '';

      page.save();

      expect(adminServiceSpy.createRestaurant).not.toHaveBeenCalled();
      expect(page.formError()).toContain('required');
    });

    it('creates a new restaurant (editingId null) then reloads the list and closes the form', () => {
      adminServiceSpy.createRestaurant.and.returnValue(of({}));
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.form = { ...page.form, name: 'New Place', city: 'Lahore', cuisineTags: 'Karahi' };

      page.save();

      expect(adminServiceSpy.createRestaurant).toHaveBeenCalled();
      expect(adminServiceSpy.updateRestaurant).not.toHaveBeenCalled();
      expect(page.formOpen()).toBeFalse();
      expect(page.saving()).toBeFalse();
    });

    it('updates the restaurant when editingId is set', () => {
      adminServiceSpy.updateRestaurant.and.returnValue(of({}));
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.editingId.set(1);
      page.form = { ...page.form, name: 'Kolachi', city: 'Karachi', cuisineTags: 'BBQ' };

      page.save();

      expect(adminServiceSpy.updateRestaurant).toHaveBeenCalledWith(1, jasmine.objectContaining({ name: 'Kolachi' }));
      expect(adminServiceSpy.createRestaurant).not.toHaveBeenCalled();
    });

    it('converts blank numeric fields to null rather than sending an empty string', () => {
      adminServiceSpy.createRestaurant.and.returnValue(of({}));
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.form = { ...page.form, name: 'X', city: 'Lahore', cuisineTags: 'BBQ', latitude: '' as unknown as null, priceTier: '' as unknown as null };

      page.save();

      expect(adminServiceSpy.createRestaurant).toHaveBeenCalledWith(jasmine.objectContaining({ latitude: null, priceTier: null }));
    });

    it('shows the server error message on failure', () => {
      adminServiceSpy.createRestaurant.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'Name already used' } })));
      const fixture = createComponent();
      const page = fixture.componentInstance;
      page.form = { ...page.form, name: 'X', city: 'Lahore', cuisineTags: 'BBQ' };

      page.save();

      expect(page.saving()).toBeFalse();
      expect(page.formError()).toBe('Name already used');
    });
  });

  describe('remove()', () => {
    it('does nothing without confirmation', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const fixture = createComponent();

      fixture.componentInstance.remove(ROW);

      expect(adminServiceSpy.deleteRestaurant).not.toHaveBeenCalled();
    });

    it('removes the restaurant from the list once confirmed', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminServiceSpy.deleteRestaurant.and.returnValue(of({}));
      const fixture = createComponent();
      const page = fixture.componentInstance;

      page.remove(ROW);

      expect(adminServiceSpy.deleteRestaurant).toHaveBeenCalledWith(1);
      expect(page.restaurants()).toEqual([]);
    });

    it('shows the server error message on failure', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminServiceSpy.deleteRestaurant.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'In use' } })));
      const fixture = createComponent();
      const page = fixture.componentInstance;

      page.remove(ROW);

      expect(page.listError()).toBe('In use');
    });
  });
});
