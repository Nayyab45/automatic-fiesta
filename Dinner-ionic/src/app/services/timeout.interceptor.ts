import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

// A stalled connection (stale dev-machine IP, a firewall silently dropping
// SYNs, a dead network) otherwise hangs a request forever -- HttpClient/RxJS
// have no default timeout, so whichever button triggered it stays stuck on
// its loading state (e.g. "Creating Account...", permanently disabled) until
// the OS-level TCP retry gives up (60s+). Applied globally, closest to the
// backend, so every page's own `error` handler -- which already resets its
// loading signal -- gets a chance to run instead of each service having to
// opt in individually (auth.service.ts previously did this per-call).
const REQUEST_TIMEOUT_MS = 15000;

export const timeoutInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    timeout(REQUEST_TIMEOUT_MS),
    catchError((err: unknown) => {
      if (err instanceof TimeoutError) {
        return throwError(
          () => new HttpErrorResponse({ status: 0, statusText: 'Request timed out', url: req.url }),
        );
      }
      return throwError(() => err);
    }),
  );
