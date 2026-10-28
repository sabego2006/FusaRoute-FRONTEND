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

/**
 * Espeja BoardingPointResponse del backend: la última milla de una punta del viaje.
 * Dónde queda el punto del trazado más cercano y cuánto hay que caminar hasta él.
 */
export interface BoardingPoint {
  latitude: number;
  longitude: number;
  distanceInMeters: number;
  walkingMinutes: number;
}

/**
 * Espeja RouteSearchResponse del backend (GET /api/routes/search y /search/offline).
 *
 * Los tres campos opcionales no son descuido: `estimatedMinutes` viene null en la
 * búsqueda offline, porque sin red el backend no le pregunta el tiempo a Google y
 * prefiere no dar un dato que no midió. `boarding` y `dropOff` vienen null en las
 * rutas que todavía no tienen trazado GeoJSON cargado, que hoy son la mayoría; esas
 * rutas se sugieren igual, solo que sin decir por dónde acercarse a pie.
 */
export interface RouteSearchResult {
  route: Route;
  estimatedMinutes: number | null;
  travelDistanceInMeters: number | null;
  boarding: BoardingPoint | null;
  dropOff: BoardingPoint | null;
}
