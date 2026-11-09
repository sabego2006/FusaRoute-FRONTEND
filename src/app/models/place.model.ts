/**
 * Espeja PlaceResponse del backend (GET /api/places): un lugar canónico de Fusagasugá,
 * ya limpio de duplicados ("Clínica Belén" y "Clinica Belen" son el mismo lugar).
 * `aliases` son otros nombres con los que la gente lo busca; el combobox los mira también.
 */
export interface Place {
  id: number;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  aliases: string[];
  routeCount: number;
}

/**
 * Lo que el usuario eligió para una punta del viaje. Es una de tres cosas, nunca una
 * mezcla: un lugar de la lista, su ubicación del GPS o un punto tocado en el mapa.
 * `label` es lo que se le muestra en el campo.
 */
export type TripEnd =
  | { kind: 'place'; place: Place; label: string }
  | { kind: 'gps'; lat: number; lng: number; label: string }
  | { kind: 'map'; lat: number; lng: number; label: string };
