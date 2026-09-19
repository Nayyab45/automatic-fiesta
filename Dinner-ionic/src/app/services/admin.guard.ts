import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// UI-level only: every admin endpoint is independently protected server-side
// by requireAdmin (see Backend/src/lib/adminAuth.js), so this just keeps a
// non-admin from landing on an empty admin shell by typing the URL.
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (authService.currentUser()?.isAdmin) {
    return true;
  }
  return inject(Router).createUrlTree(['/home']);
};
