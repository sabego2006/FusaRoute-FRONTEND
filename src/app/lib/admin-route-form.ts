import {
  AdminFareInput,
  ROUTE_NAME_MAX,
  ROUTE_NAME_MIN,
  ROUTE_NEIGHBORHOODS_MAX,
} from '../models/admin-route.model';
import { GeoJsonLineString, RouteType } from '../models/route.model';

/**
 * Reglas del formulario de rutas del administrador (RF-11).
 *
 * Son funciones puras y sin estado a propósito: anticipan lo que el backend valida para
 * dar un mensaje inmediato, pero **el backend manda**. Que una regla pase aquí no
 * garantiza que el servidor la acepte, y por eso la pantalla también muestra los
 * errores por campo del 400.
 */

/** Resultado de leer el texto pegado: o el trazado, o el motivo por el que no sirve. */
export type PathParseResult =
  | { ok: true; path: GeoJsonLineString | null }
  | { ok: false; message: string };

/**
 * Lee el GeoJSON pegado. Texto vacío es válido y significa "sin trazado" (el contrato
 * deja `pathGeoJson` opcional). Se exige un `LineString` con al menos 2 posiciones, cada
 * una `[longitud, latitud]` finita y dentro de rango.
 */
export function parsePathGeoJson(text: string): PathParseResult {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: true, path: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: 'El texto no es un JSON válido. Revisa llaves, comillas y comas.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, message: 'El GeoJSON debe ser un objeto con "type" y "coordinates".' };
  }
  const obj = parsed as Record<string, unknown>;

  if (obj['type'] === 'Feature' || obj['type'] === 'FeatureCollection') {
    return {
      ok: false,
      message: 'Pegaste un "' + String(obj['type']) + '". Pega solo la geometría: {"type":"LineString","coordinates":[…]}.',
    };
  }
  if (obj['type'] !== 'LineString') {
    return { ok: false, message: 'El tipo debe ser "LineString".' };
  }

  const coordinates = obj['coordinates'];
  if (!Array.isArray(coordinates)) {
    return { ok: false, message: 'Falta la lista "coordinates".' };
  }
  if (coordinates.length < 2) {
    return { ok: false, message: 'El trazado necesita al menos 2 posiciones.' };
  }

  const clean: [number, number][] = [];
  for (let i = 0; i < coordinates.length; i++) {
    const pos: unknown = coordinates[i];
    if (!Array.isArray(pos) || pos.length < 2
      || typeof pos[0] !== 'number' || typeof pos[1] !== 'number'
      || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) {
      return { ok: false, message: `La posición ${i + 1} debe ser [longitud, latitud] con números.` };
    }
    const [lng, lat] = pos as [number, number];
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return {
        ok: false,
        message: `La posición ${i + 1} está fuera de rango. GeoJSON escribe [longitud, latitud], en ese orden.`,
      };
    }
    clean.push([lng, lat]);
  }
  return { ok: true, path: { type: 'LineString', coordinates: clean } };
}

/** Texto de un trazado para volver a mostrarlo en el `textarea` al editar. */
export function stringifyPath(path: GeoJsonLineString | null): string {
  return path ? JSON.stringify(path) : '';
}

/** Compara nombres de barrio o de punto sin importar mayúsculas, tildes ni espacios sobrantes. */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Error del nombre, o `null` si cumple 3–140 caracteres. */
export function validateName(name: string): string | null {
  const length = name.trim().length;
  if (length < ROUTE_NAME_MIN || length > ROUTE_NAME_MAX) {
    return `El nombre debe tener entre ${ROUTE_NAME_MIN} y ${ROUTE_NAME_MAX} caracteres.`;
  }
  return null;
}

/** Errores de la lista de barrios: 1 a 40, sin vacíos ni repetidos. */
export function validateNeighborhoods(neighborhoods: readonly string[]): string | null {
  if (neighborhoods.length === 0) {
    return 'Agrega al menos un barrio.';
  }
  if (neighborhoods.length > ROUTE_NEIGHBORHOODS_MAX) {
    return `Una ruta admite hasta ${ROUTE_NEIGHBORHOODS_MAX} barrios.`;
  }
  const seen = new Set<string>();
  for (const n of neighborhoods) {
    const key = normalizeKey(n);
    if (key === '') {
      return 'Hay un barrio vacío.';
    }
    if (seen.has(key)) {
      return `El barrio "${n.trim()}" está repetido.`;
    }
    seen.add(key);
  }
  return null;
}

/** Una fila del formulario de tarifas. Los textos vienen tal cual del `<input>`. */
export interface FareDraft {
  referencePoint: string;
  amount: string;
}

/** Número del campo de monto, o `null` si está vacío o no es un número. */
export function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (text === '') {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * Error de las tarifas según el tipo. URBANA: exactamente una, sin punto de referencia.
 * INTERMUNICIPAL: una o más, todas con punto de referencia distinto. En ambas, monto > 0.
 */
export function validateFares(type: RouteType, fares: readonly FareDraft[]): string | null {
  if (type === 'URBANA') {
    if (fares.length !== 1) {
      return 'Una ruta urbana tiene una sola tarifa.';
    }
    return validateAmount(fares[0].amount);
  }

  if (fares.length === 0) {
    return 'Agrega al menos una tarifa con su punto de referencia.';
  }
  const seen = new Set<string>();
  for (const [i, fare] of fares.entries()) {
    const key = normalizeKey(fare.referencePoint);
    if (key === '') {
      return `La tarifa ${i + 1} necesita un punto de referencia.`;
    }
    if (seen.has(key)) {
      return `El punto de referencia "${fare.referencePoint.trim()}" está repetido.`;
    }
    seen.add(key);
    const amountError = validateAmount(fare.amount);
    if (amountError) {
      return `Tarifa ${i + 1}: ${amountError}`;
    }
  }
  return null;
}

function validateAmount(raw: string): string | null {
  const amount = parseAmount(raw);
  if (amount === null) {
    return 'Escribe el valor del pasaje.';
  }
  if (amount <= 0) {
    return 'El valor del pasaje debe ser mayor que cero.';
  }
  return null;
}

/**
 * Tarifas listas para enviar. En una intermunicipal salen **ordenadas por monto** (de
 * menor a mayor), que es como las muestra el catálogo público. Se llama solo con
 * tarifas ya validadas.
 */
export function buildFares(type: RouteType, fares: readonly FareDraft[]): AdminFareInput[] {
  if (type === 'URBANA') {
    return [{ amount: parseAmount(fares[0].amount) as number }];
  }
  return sortFares(fares).map((f) => ({
    amount: parseAmount(f.amount) as number,
    referencePoint: f.referencePoint.trim(),
  }));
}

/** Ordena filas por monto ascendente; las que aún no tienen monto válido quedan al final. */
export function sortFares<T extends FareDraft>(fares: readonly T[]): T[] {
  return [...fares].sort((a, b) => {
    const x = parseAmount(a.amount) ?? Number.POSITIVE_INFINITY;
    const y = parseAmount(b.amount) ?? Number.POSITIVE_INFINITY;
    return x - y;
  });
}

/** Mueve un elemento una posición (`-1` sube, `1` baja). Devuelve la misma lista si no se puede. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
