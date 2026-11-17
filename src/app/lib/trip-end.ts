import { TripEnd } from '../models/place.model';

/**
 * Estado de una punta del viaje (SCRUM-195). Una punta está en uno de tres estados:
 * vacía, con un lugar de la lista, o con un punto (GPS o mapa) que el usuario nunca ve
 * como coordenadas. Estas funciones son puras para poder probarlas sin pantalla.
 */
export type EndState = 'empty' | 'place' | 'point';

export function endState(end: TripEnd | null): EndState {
  if (!end) return 'empty';
  return end.kind === 'place' ? 'place' : 'point';
}

/** Texto legible de un punto: jamás lat/lng. `null` si la punta no es un punto. */
export function pointLabel(end: TripEnd | null): string | null {
  if (!end || end.kind === 'place') return null;
  return end.kind === 'gps' ? 'Su ubicación actual' : 'Punto en el mapa';
}

/** El punto elegido en el mapa, listo para guardarlo como punta. */
export function mapEnd(lat: number, lng: number): TripEnd {
  return { kind: 'map', lat, lng, label: 'Punto en el mapa' };
}

/**
 * ¡Hágale! se habilita cuando cada punta tiene algo elegido: un lugar de la lista O un
 * punto en el mapa/GPS. Escribir texto sin elegir no cuenta (la punta sigue vacía).
 */
export function canSearchEnds(origin: TripEnd | null, destination: TripEnd | null, loading: boolean): boolean {
  return endState(origin) !== 'empty' && endState(destination) !== 'empty' && !loading;
}
