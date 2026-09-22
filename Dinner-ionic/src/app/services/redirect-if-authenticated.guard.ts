import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Guards the public entry screens (splash, login, signup). Without this, a
// returning user with a perfectly valid stored session still saw "Get
// Started / Sign In" on every cold start -- AuthService.hydrate() restores
// the session before the router activates anything, but nothing ever acted
// on it to skip past these screens.
export const redirectIfAuthenticatedGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (authService.isAuthenticated()) {
    return inject(Router).createUrlTree(['/home']);
  }
  return true;
};
