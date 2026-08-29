import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

function withAuth(req: HttpRequest<unknown>, token: string | null) {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

// Paths where a 401 means "these credentials/this token are wrong", not
// "the access token expired" -- retrying those via refresh would either loop
// or refresh a session that was never established in the first place.
const NO_REFRESH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // inject() only works synchronously during this call, not inside the
  // catchError/switchMap callbacks below (which run later, asynchronously)
  // -- so both services are resolved up front and closed over.
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(withAuth(req, authService.token)).pipe(
    catchError((error: unknown) => {
      const isAuthExempt = NO_REFRESH_PATHS.some((path) => req.url.includes(path));
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthExempt) {
        return throwError(() => error);
      }

      return authService.refreshAccessToken().pipe(
        switchMap((newToken) => {
          if (!newToken) {
            router.navigateByUrl('/login');
            return throwError(() => error);
          }
          return next(withAuth(req, newToken));
        }),
      );
    }),
  );
};
