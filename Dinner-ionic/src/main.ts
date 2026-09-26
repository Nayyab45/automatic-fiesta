import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { provideAnimations } from '@angular/platform-browser/animations';
import { APP_INITIALIZER } from '@angular/core';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/services/auth.interceptor';
import { errorInterceptor } from './app/services/error.interceptor';
import { timeoutInterceptor } from './app/services/timeout.interceptor';
import { AuthService } from './app/services/auth.service';

bootstrapApplication(AppComponent, {
  providers: [
    // PILOT: re-added alongside the app.component.ts switch to
    // <ion-router-outlet> -- this manages ion-router-outlet's view stack
    // (which pages stay alive vs. get destroyed on navigation). Previously
    // dropped because nothing used ion-router-outlet; see app.component.ts
    // for why it's back.
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({}),
    provideAnimations(),
    provideRouter(routes),
    // Order matters for the response path (it unwinds innermost-first): put
    // timeoutInterceptor closest to the backend so it covers authInterceptor's
    // 401-refresh-retry attempt too, authInterceptor next so its retry gets
    // first look at an error, and errorInterceptor outermost so it only
    // toasts whatever's left after that -- not a 401 that's about to
    // silently succeed via a token refresh.
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor, timeoutInterceptor])),
    // Loads the persisted session from Capacitor Preferences before the
    // router activates the first route, so authGuard sees the real
    // signed-in state on cold start instead of a flash of "logged out".
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => authService.hydrate(),
      deps: [AuthService],
      multi: true,
    },
  ],
});
