import { TripEnd } from '../models/place.model';
import { RouteSearchParams } from '../models/route.model';

/**
 * Query de búsqueda para dos puntas ya elegidas. Por punta sale UNA forma: el id del
 * lugar, o lat/lng si vino del GPS o del mapa. Nunca claves vacías ni `undefined`: un
 * backend que recibe `originPlaceId=` y `originLat=` a la vez no sabría cuál creer.
 */
export function buildSearchParams(origin: TripEnd, destination: TripEnd): RouteSearchParams {
  return { ...endParams('origin', origin), ...endParams('destination', destination) };
}

function endParams(prefix: 'origin' | 'destination', end: TripEnd): RouteSearchParams {
  if (end.kind === 'place') {
    return { [`${prefix}PlaceId`]: end.place.id };
  }
  return { [`${prefix}Lat`]: end.lat, [`${prefix}Lng`]: end.lng };
}
