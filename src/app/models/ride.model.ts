/**
 * Viaje confirmado con "¡Ya me subí!". Espeja RideResponse del backend
 * (`GET /api/users/me/rides`) y es también el formato que se guarda en el navegador
 * sin sesión (`localStorage`, clave `fusaroute.viajes.v1`).
 *
 * No es una búsqueda del historial (RF-07): una búsqueda es una pregunta; un viaje
 * es lo que el usuario dijo haber tomado. El primero de la lista es el último destino.
 */
export interface Ride {
  id: number;
  routeId: number;
  routeName: string;
  signFile: string | null;
  destinationLabel: string;
  /** `null` si el destino fue un punto del mapa. */
  destinationPlaceId: number | null;
  destinationLat: number;
  destinationLng: number;
  originLabel: string;
  /** ISO-8601 con desfase (`2026-11-09T17:42:00-05:00`). */
  boardedAt: string;
}

/** Cuerpo de `POST /api/users/me/rides`. */
export interface RideRequest {
  routeId: number;
  destinationLabel: string;
  destinationPlaceId: number | null;
  destinationLat: number;
  destinationLng: number;
  originLabel: string;
}

/**
 * Lo que el botón necesita para guardar un viaje: la petición más lo que se pinta en
 * el historial (nombre y letrero de la ruta), que sin sesión no puede pedirse al backend.
 */
export interface RideDraft extends RideRequest {
  routeName: string;
  signFile: string | null;
}

export const MAX_RIDES = 10;
