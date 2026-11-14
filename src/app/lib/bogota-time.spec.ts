import { describe, it, expect } from 'vitest';
import { bogotaLocalToIso, formatBogota } from './bogota-time';

describe('bogota-time', () => {
  it('muestra un instante UTC en hora de Colombia (24 h)', () => {
    const text = formatBogota('2026-11-23T01:00:00Z');
    expect(text).toContain('22 de noviembre de 2026');
    expect(text).toContain('20:00');
  });

  it('un valor ilegible da vacío', () => {
    expect(formatBogota('no-es-fecha')).toBe('');
  });

  it('interpreta el datetime-local como hora de Colombia con offset -05:00', () => {
    expect(bogotaLocalToIso('2026-11-20T08:00')).toBe('2026-11-20T08:00:00-05:00');
    expect(bogotaLocalToIso('2026-11-20T08:00:30')).toBe('2026-11-20T08:00:30-05:00');
  });

  it('rechaza vacío o formato inválido', () => {
    expect(bogotaLocalToIso('')).toBeNull();
    expect(bogotaLocalToIso('20/11/2026 08:00')).toBeNull();
    expect(bogotaLocalToIso('2026-13-45T99:99')).toBeNull();
  });
});
