import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideAnimations } from '@angular/platform-browser/animations';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/services/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    // IonicRouteStrategy is deliberately not registered: it exists to support
    // ion-router-outlet's view stack, and this app renders through Angular's
    // plain <router-outlet>. Keeping it here left detached pages alive.
    // provideIonicAngular stays only for Ionic's platform/mode classes, which
    // the imported Ionic CSS in global.scss still keys off.
    provideIonicAngular({}),
    provideAnimations(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
});
