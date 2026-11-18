import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { Place } from '../models/place.model';
import { retryTransient } from '../lib/retry-transient';

/**
 * Lugares canónicos para el buscador (GET /api/places). Se piden una vez por sesión del
 * navegador y se guardan en memoria: la lista cambia muy rara vez y el combobox filtra
 * localmente en cada tecla, así que no hay razón para volver al backend.
 */
@Injectable({ providedIn: 'root' })
export class PlaceService {
  private readonly http = inject(HttpClient);
  private cache$: Observable<Place[]> | null = null;

  getPlaces(): Observable<Place[]> {
    if (!this.cache$) {
      // Reintentos antes de compartir (T15): sin la lista de lugares el combobox del
      // buscador queda vacío y la pantalla es inservible, así que un corte de red no
      // puede ser definitivo. Es un GET idempotente y cacheado 10 min por el borde.
      this.cache$ = this.http.get<Place[]>(`${environment.apiUrl}/api/places`).pipe(
        retryTransient(),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      // Si falla, se olvida la petición para que el próximo intento vuelva a pedirla.
      this.cache$.subscribe({ error: () => (this.cache$ = null) });
    }
    return this.cache$;
  }
}
