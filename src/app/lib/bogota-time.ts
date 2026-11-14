/**
 * Fechas de negocio en hora de Colombia (`America/Bogota`), sin importar la zona del
 * navegador. Colombia no tiene horario de verano: el offset es siempre -05:00.
 */
export const BOGOTA_TZ = 'America/Bogota';
export const BOGOTA_OFFSET = '-05:00';

const formatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: BOGOTA_TZ,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "2026-11-23T01:00:00Z" → "22 de noviembre de 2026, 20:00". Vacío si es ilegible. */
export function formatBogota(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatter.format(d);
}

/**
 * Valor de un `<input type="datetime-local">` ("2026-11-20T08:00") interpretado como
 * hora de Colombia → ISO con offset ("2026-11-20T08:00:00-05:00"). `null` si no es válido.
 */
export function bogotaLocalToIso(local: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:${m[3] ?? '00'}${BOGOTA_OFFSET}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}
