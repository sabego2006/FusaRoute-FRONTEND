import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    /** Google la invoca cuando rechaza la clave o el dominio. La define este servicio, no Google. */
    gm_authFailure?: () => void;
    /** Callback que Google invoca cuando la API terminó de instalarse. La define este servicio. */
    [CALLBACK_GOOGLE_MAPS]?: () => void;
  }
}

/**
 * Nombre del callback que se le pasa a Google en la URL. Tiene que ser una propiedad global
 * con un nombre estable, porque Google lo resuelve por texto desde `window`.
 */
const CALLBACK_GOOGLE_MAPS = '__fusarouteGoogleMapsReady' as const;

/**
 * Presupuesto de tiempo para que Google Maps termine de instalarse (T15, SCRUM-199).
 *
 * De dónde sale el número: `T15-throttle.mjs` midió la ventana de este cargador — desde que
 * se inyecta el script hasta que Google invoca el callback — en 30 corridas de red
 * estrangulada. Con la red lenta pero sana va de **1,5 s a 5,6 s** (lo peor, Slow 3G); con
 * Google respondiendo 10 s tarde, de **10,2 s a 11,3 s**.
 *
 * 12 s quedan por encima de las dos cosas: no cortan una carga normal (2,1× la peor
 * observada) ni una donde Google llega diez segundos tarde. Lo único que cortan es el caso
 * que sí pasaba: con Google que **nunca** contesta, el hueco del mapa se quedaba de
 * esqueleto para siempre, sin aviso y sin salida.
 *
 * Al vencerse NO se cancela la descarga: solo se pasa a `error`, que es lo que hace que el
 * componente muestre el aviso discreto. Si Google llega tarde, el estado vuelve a `listo`
 * y el mapa aparece.
 */
export const MAPS_LOAD_BUDGET_MS = 12_000;

/**
 * Estado público de la carga de la API de Google Maps. `MapViewComponent` (y cualquier otra
 * pieza que la use) lo lee de forma reactiva: así, si Google rechaza la clave *después* de que
 * `script.onload` ya resolvió — que es el orden real en el que Google dispara `gm_authFailure` —
 * el estado igual se actualiza, cosa que una promesa ya resuelta no puede hacer.
 */
export type MapsStatus = 'cargando' | 'listo' | 'sin-clave' | 'error';

/**
 * Inyecta el script de la Google Maps JavaScript API una sola vez por sesión del navegador.
 * Lo usa MapViewComponent y cualquier otra pieza que necesite `google.maps` (p. ej. un futuro
 * autocompletado de origen/destino): centralizar la carga evita scripts duplicados y una
 * condición de carrera si dos componentes la piden a la vez.
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleMapsLoaderService {
  private loadPromise: Promise<void> | null = null;
  private budgetTimer: ReturnType<typeof setTimeout> | null = null;

  readonly status = signal<MapsStatus>('cargando');

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.injectScript();
    }
    return this.loadPromise;
  }

  private injectScript(): Promise<void> {
    if (window.google?.maps) {
      this.status.set('listo');
      return Promise.resolve();
    }

    // Pedirle un mapa a Google sin clave es una petición que se sabe perdida: ni se intenta.
    if (!environment.googleMapsApiKey) {
      this.status.set('sin-clave');
      return Promise.reject(new Error('sin-clave'));
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      // Google invoca esto cuando la clave es inválida o el dominio no está autorizado. Puede
      // llegar antes o después de `onload`, así que no asumimos el orden.
      window.gm_authFailure = () => {
        this.fail();
        if (!settled) {
          settled = true;
          reject(new Error('carga-fallida'));
        }
      };

      // El estado 'listo' se fija en el CALLBACK de Google, no en `script.onload` (SCRUM-184).
      //
      // Con `loading=async`, `onload` dispara cuando el ARCHIVO termina de bajar, no cuando la
      // API termina de instalarse. En esa ventana `window.google.maps` ya existe pero todavía
      // le faltan piezas, y `<google-map>` de @angular/google-maps reventaba con
      // "TypeError: google.maps.importLibrary is not a function". El sintoma era un hueco en
      // blanco bajo "Recorrido en el mapa": ni mapa ni aviso de error, porque desde el punto de
      // vista del servicio la carga habia ido bien.
      //
      // El parametro `callback` es el contrato que Google documenta para `loading=async`, y es
      // lo unico que garantiza que la API esta completa antes de que nadie la use.
      window[CALLBACK_GOOGLE_MAPS] = () => {
        this.clearBudget();
        this.status.set('listo');
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      // Techo de espera (T15): sin esto, con internet lento el hueco del mapa se queda de
      // esqueleto indefinidamente. No se rechaza la promesa, porque la carga puede terminar
      // despues y entonces el mapa sí aparece.
      this.budgetTimer = setTimeout(() => {
        if (this.status() === 'cargando') {
          this.status.set('error');
        }
      }, MAPS_LOAD_BUDGET_MS);

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(environment.googleMapsApiKey)}`
        + `&v=weekly&loading=async&callback=${CALLBACK_GOOGLE_MAPS}`;
      script.async = true;
      script.onerror = () => {
        this.fail();
        if (!settled) {
          settled = true;
          reject(new Error('carga-fallida'));
        }
      };
      document.head.appendChild(script);
    });
  }

  private fail(): void {
    this.clearBudget();
    this.status.set('error');
  }

  private clearBudget(): void {
    if (this.budgetTimer !== null) {
      clearTimeout(this.budgetTimer);
      this.budgetTimer = null;
    }
  }
}
