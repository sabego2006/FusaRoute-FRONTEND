export type RouteType = 'URBANA' | 'INTERMUNICIPAL';

/** Espeja FareResponse del backend. `referencePoint` es null en la tarifa única de una ruta urbana. */
export interface Fare {
  referencePoint: string | null;
  amount: number;
  validFrom: string;
}

/**
 * Espeja RouteResponse del backend (GET /api/routes).
 *
 * `congestionSectors` es opcional y el listado NO lo manda (SCRUM-154). Decisión del
 * 2026-11-08: no se agrega al listado porque el aviso depende de la hora (se enciende 30 min
 * antes del trancón), y un listado que depende de la hora no se puede cachear 10 min en HTTP
 * (SCRUM-127) — perdería casi todo el beneficio sobre el endpoint del LCP. La tarjeta del
 * catálogo no lo pinta; el aviso vive en el detalle de la ruta, que sí lo calcula.
 */
export interface Route {
  id: number;
  name: string;
  /**
   * Archivo del letrero, que `LetreroComponent` resuelve a
   * `public/letreros/<signFile>.svg` (SCRUM-184). `null` en las tres rutas del
   * catálogo sin letrero fotografiado, y entonces no se pinta nada.
   *
   * Es opcional a propósito, y no requerido: el frontend se mergea ANTES que el
   * backend, así que durante esa ventana la respuesta todavía no trae la clave. Con
   * `?` eso significa "sin letrero" en vez de romper la pantalla.
   */
  signFile?: string | null;
  type: RouteType;
  neighborhoods: string[];
  fares: Fare[];
  congestionSectors?: CongestionSector[];
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


/**


/**

/**
 * Espeja RouteDetailResponse del backend (GET /api/routes/{id}): lo mismo que trae el
 * listado más el trazado para pintarlo en el mapa y los sectores con posible congestión.
 *
 * `path` es null mientras la ruta no tenga su GeoJSON cargado, que hoy es el caso de
 * la mayoría. El backend manda null y no un LineString vacío porque un LineString sin
 * puntos no es GeoJSON válido.
 *
 * `congestionSectors` es lista vacía si ningún sector está en franja de trancón; el
 * backend nunca manda null. El letrero se hereda de `Route.signFile` (SCRUM-184): un
 * nombre de archivo, no la lista de placas que mandaba SCRUM-176.
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
 * Query de GET /api/routes/search (y /search/offline). Por punta va UNA de dos formas:
 * el id de un lugar canónico (`…PlaceId`) o un punto (`…Lat` + `…Lng`) que sale del GPS
 * o de un toque en el mapa. El usuario nunca escribe la coordenada (SCRUM-130).
 */
export interface RouteSearchParams {
  originPlaceId?: number;
  originLat?: number;
  originLng?: number;
  destinationPlaceId?: number;
  destinationLat?: number;
  destinationLng?: number;
}

/** De dónde sale `estimatedMinutes`: tráfico actual de Google o estimado por distancia. */
export type EtaSource = 'TRAFFIC' | 'ESTIMATED';

/** Un extremo del viaje tal como lo resolvió el backend, con el nombre a mostrar. */
export interface ResolvedEnd {
  lat: number;
  lng: number;
  label: string;
}

/** La ruta más cercana a una punta, en el 404 de la búsqueda. */
export interface NearestRoute {
  routeId?: number;
  routeName: string;
  distanceInMeters: number;
}

/** Cuerpo del 404 de la búsqueda: el `detail` y, si viene, la ruta más cercana a cada punta. */
export interface RouteNotFoundProblem {
  status: number;
  detail: string;
  nearestRoutes?: { origin?: NearestRoute | null; destination?: NearestRoute | null };
  /** Presente solo si había rutas candidatas y todas están suspendidas (RF-12). */
  suspendedCandidates?: { routeId: number; routeName: string; endsAt: string }[];
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
 *
 * El letrero de la ruta sugerida viaja en `route.signFile` (SCRUM-184). Ya no hay un
 * campo `signs` aparte: con un letrero por ruta, el dato cabe en `Route`.
 */
/**
 * Espeja TripSegmentResponse.WalkGuideResponse: hacia dónde va una caminata y hasta qué
 * sitio reconocible llega.
 *
 * Los dos datos faltan por separado y por razones distintas, así que son `null` y no cadena
 * vacía: sin `bearingDegrees` cuando los dos puntos están a menos de 20 m y no hay dirección
 * que tenga sentido dar, y sin `reference` cuando ningún lugar del catálogo queda a menos de
 * 300 m del punto — nombrar uno más lejos mandaría a la persona a otra esquina.
 *
 * `bearingDegrees` llega en GRADOS desde el norte y en sentido horario (0 = norte,
 * 90 = oriente): el backend manda el dato geométrico y el frontend elige la palabra, porque
 * el idioma de la pantalla lo conoce el frontend. Ver `compassLabel` en `lib/trip-steps.ts`.
 */
export interface WalkGuide {
  bearingDegrees: number | null;
  reference: string | null;
}

/**
 * Espeja TripSegmentResponse del backend (SCRUM-198): el tramo que la persona recorre de
 * verdad, que es lo que el resultado muestra en vez de la ruta completa.
 *
 * `ridePath` es el pedazo del trazado entre la subida y la bajada — NO la ruta completa, que
 * sigue viajando en `RouteSearchResult.path` y que el resultado ya no dibuja. Es `null` si la
 * ruta no tiene trazado y entonces no se sabe cuál es el tramo.
 *
 * `neighborhoods` vacío es una respuesta VÁLIDA y frecuente, no un error ni un "todavía no se
 * calculó": con recorridos cortos no queda ningún barrio entre la subida y la bajada (en los 6
 * pares reales medidos el 17-nov, 5 recorrían entre 195 m y 1,4 km de rutas de 9 a 13 km).
 */
export interface TripSegment {
  ridePath: GeoJsonLineString | null;
  neighborhoods: string[];
  boardingWalk: WalkGuide;
  dropOffWalk: WalkGuide;
}

export interface RouteSearchResult {
  route: Route;
  estimatedMinutes: number | null;
  travelDistanceInMeters: number | null;
  boarding: BoardingPoint | null;
  dropOff: BoardingPoint | null;
  /**
   * Trazado COMPLETO de la ruta, de punta a punta. `null` si la ruta todavía no tiene su
   * GeoJSON cargado; opcional para tolerar un backend anterior a este campo.
   *
   * SCRUM-198: el resultado de la búsqueda ya NO lo dibuja — pintaba el recorrido entero y
   * hacía creer a quien toma media ruta que la recorre toda. Lo que se dibuja es
   * `tripSegment.ridePath`. Se conserva en el contrato porque el detalle de la ruta
   * (`/rutas/:id`) sí muestra el recorrido completo, que es justo lo que esa pantalla es.
   */
  path?: GeoJsonLineString | null;
  lastUpdatedAt: string | null;
  /**
   * El tramo que la persona recorre de verdad (SCRUM-198). Opcional a propósito: un backend
   * anterior a esta historia no manda la clave, y entonces el frontend cae al comportamiento
   * honesto de "no hay detalle del tramo" en vez de inventarlo o volver a la ruta completa.
   */
  tripSegment?: TripSegment | null;
  /** Opcionales: un backend anterior al contrato de lugares (P1) no los manda. */
  etaSource?: EtaSource | null;
  longWalk?: boolean;
  congestionSectors?: CongestionSector[];
  origin?: ResolvedEnd | null;
  destination?: ResolvedEnd | null;
}
