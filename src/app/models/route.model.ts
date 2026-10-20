export type RouteType = 'URBANA' | 'INTERMUNICIPAL';

/** Espeja FareResponse del backend. `referencePoint` es null en la tarifa única de una ruta urbana. */
export interface Fare {
  referencePoint: string | null;
  amount: number;
  validFrom: string;
}

/** Espeja RouteResponse del backend (GET /api/routes y GET /api/routes/{id}). */
export interface Route {
  id: number;
  name: string;
  type: RouteType;
  neighborhoods: string[];
  fares: Fare[];
}

/**
 * Cuerpo de la petición GET /api/routes/search (RF-04, SCRUM-54).
 * El backend necesita coordenadas exactas, no solo el nombre del barrio, porque
 * TravelTimePort calcula el tiempo desde el punto preciso de origen/destino sobre el
 * trazado de cada ruta candidata — el barrio solo decide qué rutas conectan.
 * TODO(SCRUM-169): hoy el formulario pide estas coordenadas a mano; cuando el
 * componente de mapa (map-view-component) esté listo, deberían salir de ahí.
 */
export interface RouteSearchParams {
  originNeighborhood: string;
  originLat: number;
  originLng: number;
  destinationNeighborhood: string;
  destinationLat: number;
  destinationLng: number;
}

/** Espeja RouteSearchResponse del backend (GET /api/routes/search → 200). */
export interface RouteSearchResult {
  route: Route;
  estimatedMinutes: number;
}
