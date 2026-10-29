import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    /** Google la invoca cuando rechaza la clave o el dominio. La define este servicio, no Google. */
    gm_authFailure?: () => void;
  }
}

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
        this.status.set('error');
        if (!settled) {
          settled = true;
          reject(new Error('carga-fallida'));
        }
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(environment.googleMapsApiKey)}&v=weekly&loading=async`;
      script.async = true;
      script.onload = () => {
        this.status.set('listo');
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      script.onerror = () => {
        this.status.set('error');
        if (!settled) {
          settled = true;
          reject(new Error('carga-fallida'));
        }
      };
      document.head.appendChild(script);
    });
  }
}
