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
