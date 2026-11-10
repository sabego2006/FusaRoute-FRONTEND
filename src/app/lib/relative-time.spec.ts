import { describe, expect, it } from 'vitest';
import { relativeTime } from './relative-time';

const AHORA = new Date('2026-11-09T22:42:00Z');
const antes = (ms: number) => new Date(AHORA.getTime() - ms).toISOString();

describe('relativeTime', () => {
  it('cubre minutos, horas, ayer y días', () => {
    expect(relativeTime(antes(10_000), AHORA)).toBe('hace un momento');
    expect(relativeTime(antes(5 * 60_000), AHORA)).toBe('hace 5 min');
    expect(relativeTime(antes(60 * 60_000), AHORA)).toBe('hace 1 hora');
    expect(relativeTime(antes(3 * 3_600_000), AHORA)).toBe('hace 3 horas');
    expect(relativeTime(antes(26 * 3_600_000), AHORA)).toBe('ayer');
    expect(relativeTime(antes(2 * 86_400_000), AHORA)).toBe('hace 2 días');
  });

  it('pasado un mes da la fecha corta', () => {
    expect(relativeTime('2026-09-01T15:00:00Z', AHORA)).toMatch(/1.*sept?/i);
  });

  it('una fecha inválida no rompe', () => {
    expect(relativeTime('no-es-fecha', AHORA)).toBe('');
  });

  it('una fecha del futuro (reloj desfasado) cuenta como recién', () => {
    expect(relativeTime(new Date(AHORA.getTime() + 60_000).toISOString(), AHORA)).toBe('hace un momento');
  });
});
