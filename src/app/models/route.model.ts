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
 * `congestionSectors` es opcional, no requerido: el listado hoy no lo manda (SCRUM-154, por
 * decisión de rendimiento — el backend evalúa el aviso por ruta y el listado no, para no cargar
 * el detalle completo en cada tarjeta). Que el tipo lo admita como opcional, en vez de omitirlo
 * del todo, deja listo el lado del frontend para el día en que el backend lo agregue, sin volver
 * a tocar este archivo.
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
 * Cuerpo de la petición GET /api/routes/search (RF-04, SCRUM-54, SCRUM-130).
 *
 * El usuario nunca escribe una coordenada: origen y destino se eligen de la lista de
 * barrios del catálogo, que es también lo único que el backend necesita para filtrar
 * qué rutas conectan. Las coordenadas son un dato aparte y opcional — hoy solo llegan
 * del origen, cuando el navegador autoriza la geolocalización, y afinan la última
 * milla; sin ellas el backend deriva un punto aproximado del nombre del barrio.
 */
export interface RouteSearchParams {
  originNeighborhood: string;
  originLat?: number;
  originLng?: number;
  destinationNeighborhood: string;
  destinationLat?: number;
  destinationLng?: number;
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
export interface RouteSearchResult {
  route: Route;
  estimatedMinutes: number | null;
  travelDistanceInMeters: number | null;
  boarding: BoardingPoint | null;
  dropOff: BoardingPoint | null;
  /**
   * Trazado para pintar el mapa en el resultado de la búsqueda, igual que el detalle.
   * `null` si la ruta todavía no tiene su GeoJSON cargado; opcional para tolerar un
   * backend anterior a este campo (no manda la clave).
   */
  path?: GeoJsonLineString | null;
  lastUpdatedAt: string | null;
}
