import { describe, expect, it } from 'vitest';
import { distinctNeighborhoods } from './neighborhoods';
import { Route } from '../models/route.model';

function route(neighborhoods: string[]): Route {
  return { id: 1, name: 'Ruta', type: 'URBANA', neighborhoods, fares: [] };
}

describe('distinctNeighborhoods', () => {
  it('une los barrios de todas las rutas sin repetir', () => {
    const routes = [route(['Centro', 'Terminal']), route(['Terminal', 'La Pampa'])];

    expect(distinctNeighborhoods(routes)).toEqual(['Centro', 'La Pampa', 'Terminal']);
  });

  it('ordena alfabéticamente respetando acentos y eñes', () => {
    const routes = [route(['Éxito', 'Ebenezer', 'Cedritos'])];

    expect(distinctNeighborhoods(routes)).toEqual(['Cedritos', 'Ebenezer', 'Éxito']);
  });

  it('sin rutas no hay barrios', () => {
    expect(distinctNeighborhoods([])).toEqual([]);
  });
});
