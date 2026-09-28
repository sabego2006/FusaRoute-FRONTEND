import { describe, it, expect } from 'vitest';
import { formatCop, formatDateEs } from './format';
import { pickNeighborhoodSteps } from './route-steps';

describe('formatCop', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCop(2600)).toMatch(/^\$\s?2\.600$/);
    expect(formatCop(9550)).toMatch(/^\$\s?9\.550$/);
  });
});

describe('formatDateEs', () => {
  it('escribe la fecha en español sin correrla de día por la zona horaria', () => {
    expect(formatDateEs('2026-02-05')).toBe('5 de febrero de 2026');
    expect(formatDateEs('2025-01-16')).toBe('16 de enero de 2025');
  });
});

describe('pickNeighborhoodSteps', () => {
  const names = (n: number) => Array.from({ length: n }, (_, i) => `Barrio ${i + 1}`);

  it('devuelve todos los barrios si son 7 o menos', () => {
    expect(pickNeighborhoodSteps(names(3))).toEqual(names(3));
    expect(pickNeighborhoodSteps(names(7))).toEqual(names(7));
  });

  it('si son más de 7, devuelve exactamente 7 incluyendo siempre el primero y el último', () => {
    for (const total of [8, 9, 13, 20]) {
      const steps = pickNeighborhoodSteps(names(total));
      expect(steps).toHaveLength(7);
      expect(steps[0]).toBe('Barrio 1');
      expect(steps[6]).toBe(`Barrio ${total}`);
      expect(new Set(steps).size).toBe(7);
    }
  });

  it('mantiene el orden de recorrido', () => {
    const steps = pickNeighborhoodSteps(names(13));
    const numbers = steps.map((s) => Number(s.split(' ')[1]));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it('con una lista vacía devuelve vacío', () => {
    expect(pickNeighborhoodSteps([])).toEqual([]);
  });
});
