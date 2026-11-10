import { describe, expect, it } from 'vitest';
import { buildSearchParams } from './trip-params';
import { MOCK_PLACES } from '../core/mock/mock-api.interceptor';
import { TripEnd } from '../models/place.model';

const indio: TripEnd = { kind: 'place', place: MOCK_PLACES[0], label: 'Indio' };
const terminal: TripEnd = { kind: 'place', place: MOCK_PLACES[4], label: 'Terminal de Transporte' };
const gps: TripEnd = { kind: 'gps', lat: 4.33, lng: -74.37, label: 'Mi ubicación' };
const mapa: TripEnd = { kind: 'map', lat: 4.34, lng: -74.36, label: 'Punto en el mapa' };

describe('buildSearchParams', () => {
  it('dos lugares viajan por id, sin coordenadas', () => {
    expect(buildSearchParams(indio, terminal)).toEqual({ originPlaceId: 12, destinationPlaceId: 40 });
  });

  it('GPS en el origen viaja como lat/lng y el destino por id', () => {
    expect(buildSearchParams(gps, terminal)).toEqual({ originLat: 4.33, originLng: -74.37, destinationPlaceId: 40 });
  });

  it('un punto del mapa en el destino viaja como lat/lng', () => {
    expect(buildSearchParams(indio, mapa)).toEqual({ originPlaceId: 12, destinationLat: 4.34, destinationLng: -74.36 });
  });

  it('nunca manda claves vacías ni undefined', () => {
    const p = buildSearchParams(gps, mapa);
    expect(Object.values(p).every((v) => v !== undefined && v !== '')).toBe(true);
    expect(Object.keys(p).sort()).toEqual(['destinationLat', 'destinationLng', 'originLat', 'originLng']);
  });
});
