import { RouteSearchResult, TripSegment } from '../models/route.model';

/**
 * Los tres momentos de "Su viaje" (SCRUM-198), armados desde el resultado de la búsqueda.
 *
 * Esto es PRESENTACIÓN, no cálculo: qué barrios quedan entre la subida y la bajada, dónde se
 * sube, dónde se baja y hacia dónde se camina lo decide el backend (`tripSegment`), porque es
 * geometría sobre el trazado. Acá solo se eligen las palabras y se decide qué momentos vale la
 * pena mostrar.
 */

/**
 * Nombres de los ocho rumbos, en el orden de los grados: el índice es el octante
 * (0 = norte, 1 = nororiente, ... 7 = noroccidente).
 *
 * Son los puntos cardinales y no "derecha/izquierda" a propósito: para decir "a la derecha"
 * habría que saber hacia dónde está mirando la persona, y eso no se sabe — el navegador da
 * posición, no orientación. Dar una derecha inventada es peor que dar un norte cierto.
 */
const COMPASS = ['norte', 'nororiente', 'oriente', 'suroriente', 'sur', 'suroccidente', 'occidente', 'noroccidente'];

/**
 * El rumbo en palabras, o `null` si no hay rumbo que decir.
 *
 * @param bearingDegrees grados desde el norte en sentido horario, tal como los manda el
 *   backend; `null` o `undefined` cuando los dos puntos están tan cerca que no hay dirección
 */
export function compassLabel(bearingDegrees: number | null | undefined): string | null {
  if (bearingDegrees === null || bearingDegrees === undefined || !Number.isFinite(bearingDegrees)) {
    return null;
  }
  const normalized = ((bearingDegrees % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 45) % 8];
}

/** Cuántos barrios del tramo se nombran antes de resumir la lista. */
export const MAX_TRIP_NEIGHBORHOODS = 5;

/**
 * Los barrios del tramo tal como se nombran: todos si son 5 o menos; si son más, 5 repartidos
 * de forma uniforme incluyendo siempre el primero y el último, y `total` dice cuántos son en
 * realidad para poder decirlo ("Pasará por 8 barrios: ...").
 *
 * Nunca agrega un barrio que el backend no haya puesto en el tramo: recortar no puede inventar.
 */
export function pickTripNeighborhoods(
  neighborhoods: string[],
  max: number = MAX_TRIP_NEIGHBORHOODS,
): { shown: string[]; total: number } {
  const total = neighborhoods.length;
  if (total <= max) {
    return { shown: neighborhoods, total };
  }
  // Con total > max el paso entre índices es mayor que 1, así que el redondeo nunca repite índice.
  const shown = Array.from({ length: max }, (_, i) => neighborhoods[Math.round((i * (total - 1)) / (max - 1))]);
  return { shown, total };
}

/** Una caminata que vale la pena mostrar como paso. */
export interface WalkStep {
  /** Metros aproximados, tal como los manda el backend (ya con el factor de rodeo x1,3). */
  meters: number;
  minutes: number;
  /** Rumbo en palabras; `null` si el backend no mandó rumbo o no hay `tripSegment`. */
  heading: string | null;
  /** Lugar al que se llega caminando; `null` si no hay ninguno lo bastante cerca para nombrarlo. */
  target: string | null;
}

/** Los tres momentos del viaje, ya decidido cuáles se muestran. */
export interface TripPlan {
  /** Caminata hasta la subida; `null` si no hay que caminar (o es menos de un minuto). */
  walkToBoarding: WalkStep | null;
  /** Dónde subir y dónde bajar, con el nombre que la persona reconoce. */
  boardAt: string | null;
  getOffAt: string | null;
  /** Barrios del tramo, ya resumidos. `shown` vacío significa que no hay ninguno que nombrar. */
  neighborhoods: { shown: string[]; total: number };
  /** Metros y minutos del tramo EN BUS (no de la ruta completa); `null` si no se saben. */
  rideMeters: number | null;
  rideMinutes: number | null;
  /** Caminata desde la bajada hasta el destino; `null` por la misma razón que la primera. */
  walkToDestination: WalkStep | null;
  /**
   * `true` cuando la ruta tiene trazado pero el backend no mandó `tripSegment`: hay subida y
   * bajada, pero no se sabe por dónde pasa el tramo ni hacia dónde se camina. El módulo lo dice
   * en vez de callarlo o de volver a mostrar la ruta completa.
   */
  missingSegmentDetail: boolean;
}

/**
 * Por debajo de un minuto la caminata no se muestra como paso: decirle a alguien "camine 0 min
 * (3 m)" es ruido que compite con los pasos que sí importan. El dato no se pierde — sigue en el
 * bloque de la caminata y en el mapa.
 */
function walkStep(
  meters: number | undefined,
  minutes: number | undefined,
  guide: { bearingDegrees: number | null; reference: string | null } | undefined,
  target: string | null,
): WalkStep | null {
  if (meters === undefined || minutes === undefined || minutes < 1 || meters <= 0) {
    return null;
  }
  return { meters, minutes, heading: compassLabel(guide?.bearingDegrees), target };
}

/**
 * Arma "Su viaje" desde el resultado de la búsqueda.
 *
 * Devuelve `null` cuando la ruta no tiene trazado (`boarding` y `dropOff` nulos): ahí no se sabe
 * dónde sube ni dónde baja, y la pantalla tiene que decirlo con honestidad en vez de mostrar tres
 * pasos vacíos.
 */
export function buildTripPlan(result: RouteSearchResult): TripPlan | null {
  const { boarding, dropOff } = result;
  if (!boarding || !dropOff) {
    return null;
  }
  const segment: TripSegment | null = result.tripSegment ?? null;
  const originLabel = result.origin?.label ?? null;
  const destinationLabel = result.destination?.label ?? null;

  return {
    // El lugar al que se camina para subir es el más cercano al punto de subida; si no hay
    // ninguno cerca, no se nombra ninguno (no se sustituye por el origen, que está en otro sitio).
    walkToBoarding: walkStep(
      boarding.distanceInMeters, boarding.walkingMinutes, segment?.boardingWalk, segment?.boardingWalk?.reference ?? null),
    boardAt: segment?.boardingWalk?.reference ?? originLabel,
    getOffAt: segment?.dropOffWalk?.reference ?? destinationLabel,
    neighborhoods: pickTripNeighborhoods(segment?.neighborhoods ?? []),
    rideMeters: result.travelDistanceInMeters ?? null,
    rideMinutes: result.estimatedMinutes ?? null,
    // Caminando desde la bajada, el sitio al que se llega es el DESTINO que la persona eligió,
    // no el lugar más cercano a la bajada (ese es donde se baja, y ya lo dice el paso 2).
    walkToDestination: walkStep(
      dropOff.distanceInMeters, dropOff.walkingMinutes, segment?.dropOffWalk, destinationLabel),
    missingSegmentDetail: segment === null,
  };
}
