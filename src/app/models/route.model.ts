export type RouteType = 'URBANA' | 'INTERMUNICIPAL';

/** Espeja FareResponse del backend. `referencePoint` es null en la tarifa única de una ruta urbana. */
export interface Fare {
  referencePoint: string | null;
  amount: number;
  validFrom: string;
}

/** Espeja RouteResponse del backend (GET /api/routes y GET /api/routes/{id}). */
export interface Route {
  id: number;
  name: string;
  type: RouteType;
  neighborhoods: string[];
  fares: Fare[];
}
