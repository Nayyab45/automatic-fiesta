import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { catchError, throwError } from 'rxjs';

// A failed request otherwise looks identical to a genuinely empty result to
// the user -- e.g. Notifications shows "You're all caught up." whether the
// inbox is empty or the request just failed outright. This only covers
// network failures (status 0) and server errors (5xx): those are never a
// legitimate response a page's own logic is equipped to explain, unlike a
// 4xx, which is usually a deliberate response (400 validation, 401 handled
// by authInterceptor, 403/404 that calling code already messages
// specifically) that a blanket toast here would just talk over. Always
// re-throws afterward so existing per-call error handling (e.g. clearing a
// loading spinner) still runs same as before. Deliberately no
// dedup/debounce guard around presenting the toast -- a page that fires a
// few parallel requests which all fail could stack a few toasts, which is a
// minor cosmetic issue; a guard that can get stuck "in flight" (e.g. if a
// promise in the present/dismiss chain never resolves) would silently
// disable every future error toast for the rest of the session, which is
// worse.
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastController = inject(ToastController);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isNetworkOrServerError = error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
      if (isNetworkOrServerError) {
        toastController
          .create({
            message: "Couldn't reach the server. Check your connection and try again.",
            duration: 3000,
            position: 'top',
            color: 'danger',
          })
          .then((toast) => toast.present());
      }
      return throwError(() => error);
    }),
  );
};
