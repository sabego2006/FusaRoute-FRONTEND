import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

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

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.injectScript();
    }
    return this.loadPromise;
  }

  private injectScript(): Promise<void> {
    if (window.google?.maps) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(environment.googleMapsApiKey)}&v=weekly&loading=async`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar la Google Maps JavaScript API.'));
      document.head.appendChild(script);
    });
  }
}
