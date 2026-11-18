import { describe, it, expect } from 'vitest';
import { buildTripPlan, compassLabel, pickTripNeighborhoods } from './trip-steps';
import { RouteSearchResult, TripSegment } from '../models/route.model';

/** Resultado de búsqueda mínimo, con el tramo que cada prueba quiera. */
function result(over: Partial<RouteSearchResult> = {}): RouteSearchResult {
  return {
    route: { id: 1, name: 'Centro - Galería - Terminal', type: 'URBANA', neighborhoods: ['A', 'B', 'C', 'D', 'E'], fares: [] },
    estimatedMinutes: 19,
    travelDistanceInMeters: 4614,
    boarding: { latitude: 4.33, longitude: -74.37, distanceInMeters: 31, walkingMinutes: 1 },
    dropOff: { latitude: 4.345, longitude: -74.377, distanceInMeters: 15, walkingMinutes: 1 },
    lastUpdatedAt: null,
    origin: { lat: 4.3316, lng: -74.3775, label: 'Monumento El Indio' },
    destination: { lat: 4.3458, lng: -74.3778, label: 'Terminal de Transporte' },
    ...over,
  };
}

function segment(over: Partial<TripSegment> = {}): TripSegment {
  return {
    ridePath: { type: 'LineString', coordinates: [[-74.37, 4.33], [-74.377, 4.345]] },
    neighborhoods: ['C', 'D', 'E'],
    boardingWalk: { bearingDegrees: 45, reference: 'Puente Águila' },
    dropOffWalk: { bearingDegrees: 180, reference: 'Plaza de Mercado' },
    ...over,
  };
}

describe('compassLabel', () => {
  it('traduce los grados a los ocho rumbos', () => {
    expect(compassLabel(0)).toBe('norte');
    expect(compassLabel(45)).toBe('nororiente');
    expect(compassLabel(90)).toBe('oriente');
    expect(compassLabel(135)).toBe('suroriente');
    expect(compassLabel(180)).toBe('sur');
    expect(compassLabel(225)).toBe('suroccidente');
    expect(compassLabel(270)).toBe('occidente');
    expect(compassLabel(315)).toBe('noroccidente');
  });

  it('redondea al rumbo más cercano y da la vuelta en 360', () => {
    expect(compassLabel(22)).toBe('norte');
    expect(compassLabel(23)).toBe('nororiente');
    expect(compassLabel(359)).toBe('norte');
    expect(compassLabel(360)).toBe('norte');
    expect(compassLabel(400)).toBe('nororiente');
  });

  it('sin rumbo no inventa una dirección', () => {
    expect(compassLabel(null)).toBeNull();
    expect(compassLabel(undefined)).toBeNull();
    expect(compassLabel(Number.NaN)).toBeNull();
  });
});

describe('pickTripNeighborhoods', () => {
  it('con 5 barrios o menos los muestra todos, en orden', () => {
    expect(pickTripNeighborhoods(['C', 'D', 'E'])).toEqual({ shown: ['C', 'D', 'E'], total: 3 });
  });

  it('con más de 5 muestra 5 repartidos, con el primero y el último', () => {
    const barrios = Array.from({ length: 9 }, (_, i) => `B${i + 1}`);
    const { shown, total } = pickTripNeighborhoods(barrios);

    expect(total).toBe(9);
    expect(shown).toHaveLength(5);
    expect(shown[0]).toBe('B1');
    expect(shown[4]).toBe('B9');
    // Repartidos: ningún índice se repite.
    expect(new Set(shown).size).toBe(5);
  });

  it('lista vacía es una respuesta válida, no un error', () => {
    expect(pickTripNeighborhoods([])).toEqual({ shown: [], total: 0 });
  });
});

describe('buildTripPlan', () => {
  it('toma los barrios del TRAMO y nunca los de la ruta completa', () => {
    // La ruta pasa por A, B, C, D, E; el tramo va de C a E.
    const plan = buildTripPlan(result({ tripSegment: segment() }));

    expect(plan?.neighborhoods.shown).toEqual(['C', 'D', 'E']);
    expect(plan?.neighborhoods.shown).not.toContain('A');
    expect(plan?.neighborhoods.shown).not.toContain('B');
  });

  it('usa el lugar de referencia del tramo para la subida y la bajada', () => {
    const plan = buildTripPlan(result({ tripSegment: segment() }));

    expect(plan?.boardAt).toBe('Puente Águila');
    expect(plan?.getOffAt).toBe('Plaza de Mercado');
  });

  it('sin lugar de referencia cae al origen y al destino que eligió la persona', () => {
    const sinReferencia = segment({
      boardingWalk: { bearingDegrees: 45, reference: null },
      dropOffWalk: { bearingDegrees: 180, reference: null },
    });
    const plan = buildTripPlan(result({ tripSegment: sinReferencia }));

    expect(plan?.boardAt).toBe('Monumento El Indio');
    expect(plan?.getOffAt).toBe('Terminal de Transporte');
  });

  it('una caminata de menos de un minuto no se muestra como paso', () => {
    const plan = buildTripPlan(result({
      boarding: { latitude: 4.33, longitude: -74.37, distanceInMeters: 31, walkingMinutes: 1 },
      dropOff: { latitude: 4.345, longitude: -74.377, distanceInMeters: 0, walkingMinutes: 0 },
      tripSegment: segment(),
    }));

    expect(plan?.walkToBoarding).not.toBeNull();
    expect(plan?.walkToDestination).toBeNull();
  });

  it('una caminata de 0 m tampoco, aunque el backend redondee el minuto hacia arriba', () => {
    const plan = buildTripPlan(result({
      boarding: { latitude: 4.33, longitude: -74.37, distanceInMeters: 0, walkingMinutes: 1 },
      tripSegment: segment(),
    }));

    expect(plan?.walkToBoarding).toBeNull();
  });

  it('el último paso camina hasta el DESTINO, no hasta donde se baja', () => {
    const plan = buildTripPlan(result({ tripSegment: segment() }));

    // El lugar de la bajada ("Plaza de Mercado") es donde se baja y ya lo dice el paso del bus.
    expect(plan?.walkToDestination?.target).toBe('Terminal de Transporte');
    expect(plan?.walkToDestination?.heading).toBe('sur');
  });

  it('sin trazado no hay plan que mostrar', () => {
    expect(buildTripPlan(result({ boarding: null, dropOff: null }))).toBeNull();
    expect(buildTripPlan(result({ boarding: null }))).toBeNull();
    expect(buildTripPlan(result({ dropOff: null }))).toBeNull();
  });

  it('un backend sin tripSegment deja el plan honesto: sin barrios, sin rumbo y marcado', () => {
    const plan = buildTripPlan(result({ tripSegment: undefined }));

    expect(plan?.missingSegmentDetail).toBe(true);
    expect(plan?.neighborhoods.shown).toEqual([]);
    expect(plan?.walkToBoarding?.heading).toBeNull();
    expect(plan?.walkToBoarding?.target).toBeNull();
    // Lo que sí se sabe se sigue mostrando: el origen y el destino que eligió la persona.
    expect(plan?.boardAt).toBe('Monumento El Indio');
    expect(plan?.getOffAt).toBe('Terminal de Transporte');
  });

  it('con tramo pero sin barrios intermedios el plan existe y la lista queda vacía', () => {
    // Es el caso de 5 de los 6 pares reales medidos: recorridos de 195 m a 1,4 km.
    const plan = buildTripPlan(result({
      travelDistanceInMeters: 868,
      estimatedMinutes: 4,
      tripSegment: segment({ neighborhoods: [] }),
    }));

    expect(plan?.missingSegmentDetail).toBe(false);
    expect(plan?.neighborhoods).toEqual({ shown: [], total: 0 });
    expect(plan?.rideMeters).toBe(868);
    expect(plan?.rideMinutes).toBe(4);
  });
});
