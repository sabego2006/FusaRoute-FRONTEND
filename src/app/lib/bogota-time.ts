const BOGOTA = 'America/Bogota';

const HORA = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: BOGOTA,
});

/**
 * Hora del día en Colombia (p. ej. "11:59 p. m.") de un instante ISO-8601,
 * sin importar la zona del navegador. Devuelve cadena vacía si la fecha no es válida.
 */
export function formatBogotaTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : HORA.format(date);
}
