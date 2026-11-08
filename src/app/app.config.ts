import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    /*
     * Transiciones de vista nativas al cambiar de pantalla. El navegador cruza
     * la vista que sale con la que entra en el compositor, que es la única
     * forma de animar un cambio de ruta sin mantener las dos vivas en el DOM.
     *
     * `skipInitialTransition` deja la primera carga sin animación: la pantalla
     * inicial no viene de ninguna otra, así que cruzarla contra una pantalla
     * vacía solo retrasaría el primer pintado — y ese es justo el número que el
     * RNF mide.
     *
     * Donde no hay soporte, Angular navega sin animación. Nada se rompe.
     */
    provideRouter(routes, withViewTransitions({ skipInitialTransition: true })),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
