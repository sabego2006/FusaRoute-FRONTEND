import { RouteType } from '../models/route.model';

/**
 * Municipio que una ruta "dice" en su chip (T05, rasgo R5: paleta por municipio).
 *
 * Es presentación, no negocio: el backend no manda el municipio y no se le pide un
 * endpoint por un color. Una ruta urbana es de Fusagasugá; una intermunicipal se
 * reconoce por el nombre del destino que lleva en el letrero. Si el nombre no
 * nombra ninguno de la provincia, el chip dice "Sumapaz" con el color de Fusa:
 * mejor un chip genérico que uno inventado.
 *
 * `slug` es el sufijo de `.fr-chip-muni--<slug>` y de `--muni-<slug>` en styles.css.
 */
export interface Municipality {
  slug: 'fusagasuga' | 'pasca' | 'arbelaez' | 'silvania' | 'granada' | 'tibacuy' | 'venecia' | 'san-bernardo' | 'pandi' | 'cabrera';
  name: string;
}

const FUSAGASUGA: Municipality = { slug: 'fusagasuga', name: 'Fusagasugá' };

const BY_NAME: [RegExp, Municipality][] = [
  [/pasca/i, { slug: 'pasca', name: 'Pasca' }],
  [/arbel[aá]ez/i, { slug: 'arbelaez', name: 'Arbeláez' }],
  [/silvania/i, { slug: 'silvania', name: 'Silvania' }],
  [/granada/i, { slug: 'granada', name: 'Granada' }],
  [/tibacuy/i, { slug: 'tibacuy', name: 'Tibacuy' }],
  [/venecia/i, { slug: 'venecia', name: 'Venecia' }],
  [/san bernardo/i, { slug: 'san-bernardo', name: 'San Bernardo' }],
  [/pandi/i, { slug: 'pandi', name: 'Pandi' }],
  [/cabrera/i, { slug: 'cabrera', name: 'Cabrera' }],
  // Chinauta y Boquerón son corregimientos de Fusagasugá: mismo color, otro nombre.
  [/chinauta|boquer[oó]n/i, { slug: 'fusagasuga', name: 'Chinauta' }],
];

export function municipalityOf(name: string, type: RouteType): Municipality {
  if (type === 'URBANA') return FUSAGASUGA;
  const hit = BY_NAME.find(([re]) => re.test(name));
  return hit ? hit[1] : { slug: 'fusagasuga', name: 'Sumapaz' };
}
