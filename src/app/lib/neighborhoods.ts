import { Route } from '../models/route.model';

/**
 * Nombres de barrio distintos entre todas las rutas del catálogo, en orden alfabético
 * (SCRUM-130). Alimenta los selectores de origen/destino del buscador: el usuario
 * nunca escribe un nombre a mano, elige uno que ya existe en el catálogo — así no
 * puede escribir algo que el backend no reconozca por una mayúscula o un acento distinto.
 */
export function distinctNeighborhoods(routes: Route[]): string[] {
  const names = new Set<string>();
  for (const route of routes) {
    for (const neighborhood of route.neighborhoods) {
      names.add(neighborhood);
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
}
