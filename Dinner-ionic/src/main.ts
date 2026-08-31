import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { provideAnimations } from '@angular/platform-browser/animations';
import { APP_INITIALIZER } from '@angular/core';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/services/auth.interceptor';
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
    provideHttpClient(withInterceptors([authInterceptor])),
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
