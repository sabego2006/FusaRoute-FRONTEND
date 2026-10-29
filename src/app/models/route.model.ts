export type RouteType = 'URBANA' | 'INTERMUNICIPAL';

/** Espeja FareResponse del backend. `referencePoint` es null en la tarifa única de una ruta urbana. */
export interface Fare {
  referencePoint: string | null;
  amount: number;
  validFrom: string;
}

/** Espeja RouteResponse del backend (GET /api/routes). */
export interface Route {
  id: number;
  name: string;
  type: RouteType;
  neighborhoods: string[];
  fares: Fare[];
}

/**
 * Trazado de una ruta tal como lo manda el backend: un LineString de GeoJSON.
 *
 * Ojo con el orden de cada par: GeoJSON escribe **[longitud, latitud]**, al revés de
 * como se nombran al hablar. No se reordena aquí a propósito — se le pasa tal cual a
 * la librería de mapas, que espera GeoJSON estándar.
 */
export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

/**
 * Espeja CongestionSectorResponse del backend (RF-09): un sector que el recorrido
 * atraviesa y que está en su franja de trancón ahora mismo. Viajan los hechos (qué
 * sector y en qué franja), no una frase: el texto en condicional ("puede haber
 * congestión") lo arma el frontend, porque el dato es histórico, no una medición en vivo.
 * `startsAt` y `endsAt` llegan como "HH:mm:ss".
 */
export interface CongestionSector {
  name: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Espeja RouteDetailResponse del backend (GET /api/routes/{id}): lo mismo que trae el
 * listado más el trazado para pintarlo en el mapa y los sectores con posible congestión.
 *
 * `path` es null mientras la ruta no tenga su GeoJSON cargado, que hoy es el caso de
 * la mayoría. El backend manda null y no un LineString vacío porque un LineString sin
 * puntos no es GeoJSON válido.
 *
 * `congestionSectors` es lista vacía si ningún sector está en franja de trancón; el
 * backend nunca manda null.
 *
 * `lastUpdatedAt` es el `validFrom` más reciente entre las tarifas vigentes (RF-06); null
 * significa que la ruta no tiene ninguna tarifa vigente. En una intermunicipal es la fecha
 * del precio que cambió más recientemente, no la de todos los de la tabla.
 */
export interface RouteDetail extends Route {
  path: GeoJsonLineString | null;
  congestionSectors: CongestionSector[];
  lastUpdatedAt: string | null;
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
 * Los campos opcionales no son descuido: `estimatedMinutes` viene null en la
 * búsqueda offline, porque sin red el backend no le pregunta el tiempo a Google y
 * prefiere no dar un dato que no midió. `boarding` y `dropOff` vienen null en las
 * rutas que todavía no tienen trazado GeoJSON cargado, que hoy son la mayoría; esas
 * rutas se sugieren igual, solo que sin decir por dónde acercarse a pie. `lastUpdatedAt`
 * es el `validFrom` más reciente entre las tarifas vigentes de la ruta sugerida (RF-06);
 * null si no tiene ninguna.
 */
export interface RouteSearchResult {
  route: Route;
  estimatedMinutes: number | null;
  travelDistanceInMeters: number | null;
  boarding: BoardingPoint | null;
  dropOff: BoardingPoint | null;
  lastUpdatedAt: string | null;
}
