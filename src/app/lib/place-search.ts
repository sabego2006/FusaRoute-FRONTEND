import { Place } from '../models/place.model';

/** Sin tildes, sin mayúsculas y con espacios colapsados: "Clínica  Belén" → "clinica belen". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distancia de edición clásica, con corte temprano: solo interesa saber si es ≤ max. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/** Tolerancia de letras equivocadas según el largo de lo escrito: "ind" no tolera ninguna. */
function allowedTypos(query: string): number {
  if (query.length < 4) return 0;
  return query.length < 7 ? 1 : 2;
}

/**
 * Qué tan bien casa un nombre con lo escrito: 0 empieza con, 1 alguna palabra empieza
 * con, 2 contiene, 3 aproximado (errores de 1–2 letras contra una palabra o su prefijo).
 * `null` si no casa.
 */
function scoreName(name: string, query: string): number | null {
  if (name.startsWith(query)) return 0;
  const words = name.split(' ');
  if (words.some((w) => w.startsWith(query))) return 1;
  if (name.includes(query)) return 2;
  const typos = allowedTypos(query);
  if (typos === 0) return null;
  const close = [name, ...words].some((w) =>
    editDistance(w.slice(0, query.length), query, typos) <= typos
    || editDistance(w, query, typos) <= typos);
  return close ? 3 : null;
}

export const MAX_SUGGESTIONS = 8;

/**
 * Sugerencias para lo escrito: empieza con → contiene → aproximado, y dentro de cada
 * grupo primero los lugares con más rutas (los que la gente más busca), luego alfabético.
 * El alias cuenta igual que el nombre. Con el campo vacío no sugiere nada.
 */
export function rankPlaces(places: Place[], query: string, limit = MAX_SUGGESTIONS): Place[] {
  const q = normalizeText(query);
  if (!q) return [];
  const scored: { place: Place; score: number }[] = [];
  for (const place of places) {
    const scores = [place.name, ...place.aliases]
      .map((n) => scoreName(normalizeText(n), q))
      .filter((s): s is number => s !== null);
    if (scores.length) scored.push({ place, score: Math.min(...scores) });
  }
  return scored
    .sort((a, b) =>
      a.score - b.score
      || b.place.routeCount - a.place.routeCount
      || a.place.name.localeCompare(b.place.name, 'es'))
    .slice(0, limit)
    .map((s) => s.place);
}

/** El lugar cuyo nombre o alias es exactamente lo escrito (ignorando tildes), si hay uno. */
export function findExactPlace(places: Place[], text: string): Place | undefined {
  const q = normalizeText(text);
  if (!q) return undefined;
  return places.find((p) => [p.name, ...p.aliases].some((n) => normalizeText(n) === q));
}
