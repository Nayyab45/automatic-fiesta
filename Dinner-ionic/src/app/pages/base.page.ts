import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

/**
 * Shared navigation behaviour for routed screens.
 *
 * Every page generated from the prototype carried its own identical copy of
 * `go()` and `goBack()` plus the constructor injection they needed -- 58
 * duplicates of the same eight lines. They live here instead.
 *
 * Uses `inject()` rather than constructor parameters so subclasses do not have
 * to declare a constructor (and remember to call `super()`) just to pull in
 * their own services.
 */
export abstract class BasePage {
  protected readonly router = inject(Router);
  protected readonly location = inject(Location);
  protected readonly route = inject(ActivatedRoute);

  /**
   * The `:id` segment for screens routed with one, or null for those routed
   * without. Detail screens still have paramless routes so existing links keep
   * working while there is no data layer to look an id up in.
   *
   * A signal rather than a snapshot read: navigating between two records of the
   * same kind (restaurant A -> restaurant B) reuses the component rather than
   * recreating it, so a snapshot taken at construction would go stale.
   */
  readonly routeId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  /** Navigate to an absolute in-app path. */
  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  /** Step back through history. */
  goBack(): void {
    this.location.back();
  }
}
