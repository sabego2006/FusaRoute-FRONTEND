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
  /**
   * Si la ruta de ese viaje sigue en el catálogo (RF-11: un administrador puede
   * eliminarla). La decisión es del backend; aquí solo se pinta «Ruta ya no disponible»
   * cuando llega en `false`.
   *
   * Opcional a propósito: el frontend puede mergearse antes que el backend, y los viajes
   * guardados en el navegador sin sesión no la traen. Ausente se trata como disponible.
   */
  routeAvailable?: boolean;
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
