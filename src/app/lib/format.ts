const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/** Pesos colombianos, sin decimales: 2600 → "$ 2.600". */
export function formatCop(amount: number): string {
  return cop.format(amount);
}

/**
 * "2026-02-05" → "5 de febrero de 2026". Se parte el texto a mano y no se usa Date:
 * una fecha sin hora se interpreta en UTC y en Colombia (UTC-5) mostraría el día anterior.
 */
export function formatDateEs(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

/**
 * "2025-01-16" → "16/01/2025". Para celdas angostas (tabla de tarifas a 320 px), donde
 * "16 de enero de 2025" partido en cuatro renglones no se lee.
 */
export function formatDateShort(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Una distancia en metros, dicha como la diría una persona: 868 → "868 m", 4614 → "4,6 km".
 *
 * El corte está en el kilómetro porque "4614 m" obliga a contar cifras para saber de qué tamaño
 * es el viaje, y el módulo "Su viaje" existe justo para que no haya que hacer esa cuenta. Coma
 * decimal, que es como se escribe en Colombia.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** "08:30:00" → "08:30". El backend manda la hora con segundos; al usuario le sobran. */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}
