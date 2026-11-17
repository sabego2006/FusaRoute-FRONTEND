import { describe, expect, it } from 'vitest';
import { MOCK_PLACES } from '../core/mock/mock-api.interceptor';
import { TripEnd } from '../models/place.model';
import { canSearchEnds, endState, mapEnd, pointLabel } from './trip-end';

const place: TripEnd = { kind: 'place', place: MOCK_PLACES[0], label: MOCK_PLACES[0].name };
const gps: TripEnd = { kind: 'gps', lat: 4.3, lng: -74.3, label: 'Su ubicación actual' };

describe('trip-end', () => {
  it('endState distingue vacío, lugar y punto', () => {
    expect(endState(null)).toBe('empty');
    expect(endState(place)).toBe('place');
    expect(endState(gps)).toBe('point');
    expect(endState(mapEnd(1, 2))).toBe('point');
  });

  it('pointLabel nunca devuelve coordenadas y es null para un lugar', () => {
    expect(pointLabel(place)).toBeNull();
    expect(pointLabel(null)).toBeNull();
    expect(pointLabel(mapEnd(4.34, -74.36))).toBe('Punto en el mapa');
    expect(pointLabel(gps)).toBe('Su ubicación actual');
  });

  it('canSearchEnds: ambos vacíos, uno solo, lugar+punto, y mientras carga', () => {
    expect(canSearchEnds(null, null, false)).toBe(false);
    expect(canSearchEnds(place, null, false)).toBe(false);
    expect(canSearchEnds(null, mapEnd(1, 2), false)).toBe(false);
    expect(canSearchEnds(place, mapEnd(1, 2), false)).toBe(true);
    expect(canSearchEnds(mapEnd(1, 2), mapEnd(3, 4), false)).toBe(true);
    expect(canSearchEnds(gps, place, true)).toBe(false);
  });
});
