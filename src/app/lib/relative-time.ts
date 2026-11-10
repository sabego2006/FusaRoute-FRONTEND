const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/**
 * "hace 2 días" para el historial de viajes. Pasado un mes se pasa a la fecha corta
 * ("9 nov"), que se lee mejor que "hace 47 días". Una fecha inválida devuelve ''.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now.getTime() - t);
  if (diff < MIN) return 'hace un momento';
  if (diff < HORA) {
    const m = Math.floor(diff / MIN);
    return `hace ${m} min`;
  }
  if (diff < DIA) {
    const h = Math.floor(diff / HORA);
    return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  }
  const d = Math.floor(diff / DIA);
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  return new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
}
