import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { MAX_RIDES, Ride, RideDraft, RideRequest } from '../models/ride.model';

/** Clave del navegador para los viajes sin sesión. El `.v1` permite cambiar el formato sin leer basura. */
export const RIDES_STORAGE_KEY = 'fusaroute.viajes.v1';

/**
 * "¡Ya me subí!" y "Tus últimos viajes".
 *
 * - **Con sesión** los viajes viven en la cuenta (`/api/users/me/rides`): los mismos en
 *   cualquier dispositivo. El backend recorta a 10.
 * - **Sin sesión** viven en este navegador (`localStorage`), mismo formato, máximo 10.
 *   Todo acceso va en try/catch: en modo privado o con el almacenamiento bloqueado la
 *   pantalla sigue funcionando y el viaje queda solo en memoria hasta recargar.
 *
 * Al iniciar sesión los viajes del navegador **no** se migran a la cuenta (decisión
 * cerrada: complica y no se pidió).
 */
@Injectable({ providedIn: 'root' })
export class RideService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly url = `${environment.apiUrl}/api/users/me/rides`;

  private readonly _rides = signal<Ride[]>([]);
  /** Del más nuevo al más viejo, máximo 10. */
  readonly rides = this._rides.asReadonly();
  /** El "último destino al que fuiste": el viaje más reciente. */
  readonly lastRide = computed<Ride | null>(() => this._rides()[0] ?? null);

  /** Carga los viajes de donde correspondan según haya sesión o no. */
  load(): void {
    if (this.auth.isLoggedIn()) {
      this.http.get<Ride[]>(this.url).subscribe({
        next: (rides) => this._rides.set(rides.slice(0, MAX_RIDES)),
        // Sin historial no se rompe nada: el atajo y la lista simplemente no salen.
        error: () => this._rides.set([]),
      });
    } else {
      this._rides.set(readStored());
    }
  }

  /** Guarda el viaje. Devuelve el viaje guardado; falla solo si falla el backend. */
  board(draft: RideDraft): Observable<Ride> {
    if (this.auth.isLoggedIn()) {
      const body: RideRequest = {
        routeId: draft.routeId,
        destinationLabel: draft.destinationLabel,
        destinationPlaceId: draft.destinationPlaceId,
        destinationLat: draft.destinationLat,
        destinationLng: draft.destinationLng,
        originLabel: draft.originLabel,
      };
      return this.http.post<Ride>(this.url, body).pipe(tap((ride) => this.prepend(ride)));
    }
    const ride: Ride = {
      id: Date.now(),
      routeId: draft.routeId,
      routeName: draft.routeName,
      signFile: draft.signFile,
      destinationLabel: draft.destinationLabel,
      destinationPlaceId: draft.destinationPlaceId,
      destinationLat: draft.destinationLat,
      destinationLng: draft.destinationLng,
      originLabel: draft.originLabel,
      boardedAt: new Date().toISOString(),
    };
    return of(ride).pipe(
      map((r) => {
        this.prepend(r);
        writeStored(this._rides());
        return r;
      }),
    );
  }

  private prepend(ride: Ride): void {
    this._rides.update((list) => [ride, ...list.filter((r) => r.id !== ride.id)].slice(0, MAX_RIDES));
  }
}

function readStored(): Ride[] {
  try {
    const raw = localStorage.getItem(RIDES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRide).slice(0, MAX_RIDES);
  } catch {
    // Almacenamiento bloqueado o JSON corrupto: se arranca sin historial.
    return [];
  }
}

function writeStored(rides: Ride[]): void {
  try {
    localStorage.setItem(RIDES_STORAGE_KEY, JSON.stringify(rides.slice(0, MAX_RIDES)));
  } catch {
    // Cuota llena o modo privado: el viaje queda en memoria y la pantalla sigue igual.
  }
}

function isRide(value: unknown): value is Ride {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r['id'] === 'number'
    && typeof r['routeId'] === 'number'
    && typeof r['routeName'] === 'string'
    && typeof r['destinationLabel'] === 'string'
    && typeof r['destinationLat'] === 'number'
    && typeof r['destinationLng'] === 'number'
    && typeof r['boardedAt'] === 'string';
}
