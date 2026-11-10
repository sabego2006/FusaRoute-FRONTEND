import { describe, expect, it } from 'vitest';
import { editDistance, findExactPlace, normalizeText, rankPlaces } from './place-search';
import { MOCK_PLACES } from '../core/mock/mock-api.interceptor';
import { Place } from '../models/place.model';

const names = (ps: Place[]) => ps.map((p) => p.name);

describe('place-search', () => {
  it('normaliza tildes, mayúsculas y espacios', () => {
    expect(normalizeText('  Clínica   BELÉN ')).toBe('clinica belen');
  });

  it('distancia de edición corta temprano', () => {
    expect(editDistance('terminal', 'termnal')).toBe(1);
    expect(editDistance('indio', 'xxxxxxxx')).toBe(3);
  });

  it('con el campo vacío no sugiere nada', () => {
    expect(rankPlaces(MOCK_PLACES, '   ')).toEqual([]);
  });

  it('encuentra sin importar tildes ni mayúsculas', () => {
    expect(names(rankPlaces(MOCK_PLACES, 'AGUILA'))).toContain('Puente Águila');
    expect(names(rankPlaces(MOCK_PLACES, 'clinica belen'))).toEqual(['Clínica Belén']);
  });

  it('busca también por alias', () => {
    expect(names(rankPlaces(MOCK_PLACES, 'monumento'))).toEqual(['Indio']);
    expect(names(rankPlaces(MOCK_PLACES, 'galería'))).toEqual(['Plaza de Mercado']);
  });

  it('ordena empieza con → contiene → aproximado', () => {
    const places: Place[] = [
      { id: 1, slug: 'a', name: 'La Palma', lat: 0, lng: 0, aliases: [], routeCount: 50 },
      { id: 2, slug: 'b', name: 'Palmira', lat: 0, lng: 0, aliases: [], routeCount: 1 },
      { id: 3, slug: 'c', name: 'Napalmo', lat: 0, lng: 0, aliases: [], routeCount: 99 },
      { id: 4, slug: 'd', name: 'Polma', lat: 0, lng: 0, aliases: [], routeCount: 99 },
    ];
    // Palmira empieza con; La Palma tiene una palabra que empieza; Napalmo contiene; Polma es aproximado.
    expect(names(rankPlaces(places, 'palm'))).toEqual(['Palmira', 'La Palma', 'Napalmo', 'Polma']);
  });

  it('dentro del mismo grupo van primero los lugares con más rutas', () => {
    const places: Place[] = [
      { id: 1, slug: 'a', name: 'Terminal B', lat: 0, lng: 0, aliases: [], routeCount: 2 },
      { id: 2, slug: 'b', name: 'Terminal A', lat: 0, lng: 0, aliases: [], routeCount: 9 },
    ];
    expect(names(rankPlaces(places, 'term'))).toEqual(['Terminal A', 'Terminal B']);
  });

  it('tolera errores de 1–2 letras, pero no en textos muy cortos', () => {
    expect(names(rankPlaces(MOCK_PLACES, 'termnal'))).toContain('Terminal de Transporte');
    expect(names(rankPlaces(MOCK_PLACES, 'mercdo'))).toContain('Plaza de Mercado');
    expect(rankPlaces(MOCK_PLACES, 'inx')).toEqual([]);
  });

  it('sugiere máximo 8', () => {
    const many: Place[] = Array.from({ length: 20 }, (_, i) =>
      ({ id: i, slug: `b${i}`, name: `Barrio ${i}`, lat: 0, lng: 0, aliases: [], routeCount: 1 }));
    expect(rankPlaces(many, 'barrio')).toHaveLength(8);
  });

  it('findExactPlace casa nombre o alias completos', () => {
    expect(findExactPlace(MOCK_PLACES, 'terminal')?.name).toBe('Terminal de Transporte');
    expect(findExactPlace(MOCK_PLACES, 'indi')).toBeUndefined();
  });
});
