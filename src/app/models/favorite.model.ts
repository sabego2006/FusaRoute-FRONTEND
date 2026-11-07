import { CongestionSector } from './route.model';

/**
 * Espeja `FavoriteDestinationResponse` del backend (RF-10, SCRUM-21).
 *
 * El aviso de tranco viaja dentro del favorito y no aparte: el criterio de aceptación
 * pide que al abrir la búsqueda se vea de una vez el aviso habitual de ese destino
 * "sin necesidad de iniciar una búsqueda", y con una sola petición la pantalla ya
 * tiene todo lo que necesita para pintarse.
 *
 * `congestionSectors` se calcula sobre el **barrio** del favorito, no sobre una ruta:
 * antes de buscar todavía no hay origen, así que todavía no hay recorrido.
 */
export interface FavoriteDestination {
  destination: string;
  savedAt: string;
  congestionSectors: CongestionSector[];
}

/** Cuerpo de `PUT /api/users/me/favorite-destination`. */
export interface SetFavoriteDestinationRequest {
  destination: string;
}
