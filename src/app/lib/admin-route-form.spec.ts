import { describe, it, expect } from 'vitest';
import {
  buildFares,
  moveItem,
  normalizeKey,
  parseAmount,
  parsePathGeoJson,
  sortFares,
  stringifyPath,
  validateFares,
  validateName,
  validateNeighborhoods,
} from './admin-route-form';

describe('parsePathGeoJson', () => {
  const valido = '{"type":"LineString","coordinates":[[-74.37,4.34],[-74.36,4.35]]}';

  it('texto vacío es válido y significa sin trazado', () => {
    expect(parsePathGeoJson('   ')).toEqual({ ok: true, path: null });
  });

  it('acepta un LineString con 2 posiciones', () => {
    const r = parsePathGeoJson(valido);
    expect(r).toEqual({
      ok: true,
      path: { type: 'LineString', coordinates: [[-74.37, 4.34], [-74.36, 4.35]] },
    });
  });

  it('rechaza JSON mal formado', () => {
    const r = parsePathGeoJson('{"type":');
    expect(r.ok).toBe(false);
  });

  it('rechaza un Feature y dice que se pegue solo la geometría', () => {
    const r = parsePathGeoJson('{"type":"Feature","geometry":{}}');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain('geometría');
  });

  it('rechaza otro tipo de geometría', () => {
    const r = parsePathGeoJson('{"type":"Point","coordinates":[1,2]}');
    expect(!r.ok && r.message).toContain('LineString');
  });

  it('rechaza menos de 2 posiciones', () => {
    const r = parsePathGeoJson('{"type":"LineString","coordinates":[[-74.37,4.34]]}');
    expect(!r.ok && r.message).toContain('2 posiciones');
  });

  it('rechaza una posición que no son dos números', () => {
    const r = parsePathGeoJson('{"type":"LineString","coordinates":[[-74.37,4.34],["a","b"]]}');
    expect(!r.ok && r.message).toContain('posición 2');
  });

  it('rechaza latitud y longitud fuera de rango (orden invertido)', () => {

    const r = parsePathGeoJson('{"type":"LineString","coordinates":[[-74.37,95],[-74.36,4.35]]}');
    expect(!r.ok && r.message).toContain('fuera de rango');
  });

  it('stringifyPath devuelve texto vacío si no hay trazado', () => {
    expect(stringifyPath(null)).toBe('');
    expect(parsePathGeoJson(stringifyPath({ type: 'LineString', coordinates: [[1, 2], [3, 4]] })).ok).toBe(true);
  });
});

describe('validateName', () => {
  it('exige entre 3 y 140 caracteres sin contar espacios de los extremos', () => {
    expect(validateName('ab')).not.toBeNull();
    expect(validateName('  ab  ')).not.toBeNull();
    expect(validateName('abc')).toBeNull();
    expect(validateName('a'.repeat(140))).toBeNull();
    expect(validateName('a'.repeat(141))).not.toBeNull();
  });
});

describe('validateNeighborhoods', () => {
  it('exige al menos uno', () => {
    expect(validateNeighborhoods([])).toContain('al menos un barrio');
  });

  it('admite hasta 40 y rechaza 41', () => {
    const cuarenta = Array.from({ length: 40 }, (_, i) => `Barrio ${i}`);
    expect(validateNeighborhoods(cuarenta)).toBeNull();
    expect(validateNeighborhoods([...cuarenta, 'Barrio extra'])).toContain('40');
  });

  it('rechaza repetidos sin importar mayúsculas ni tildes', () => {
    expect(validateNeighborhoods(['Los Cámbulos', 'los cambulos'])).toContain('repetido');
  });

  it('rechaza uno vacío', () => {
    expect(validateNeighborhoods(['Centro', '  '])).toContain('vacío');
  });
});

describe('validateFares', () => {
  it('URBANA exige exactamente una tarifa con monto mayor que cero', () => {
    expect(validateFares('URBANA', [])).not.toBeNull();
    expect(validateFares('URBANA', [{ referencePoint: '', amount: '' }])).toContain('valor');
    expect(validateFares('URBANA', [{ referencePoint: '', amount: '0' }])).toContain('mayor que cero');
    expect(validateFares('URBANA', [{ referencePoint: '', amount: '-5' }])).toContain('mayor que cero');
    expect(validateFares('URBANA', [{ referencePoint: '', amount: '2600' }])).toBeNull();
    expect(validateFares('URBANA', [
      { referencePoint: '', amount: '2600' },
      { referencePoint: '', amount: '3000' },
    ])).toContain('una sola');
  });

  it('INTERMUNICIPAL exige al menos una tarifa', () => {
    expect(validateFares('INTERMUNICIPAL', [])).toContain('al menos una');
  });

  it('INTERMUNICIPAL exige punto de referencia en cada tarifa', () => {
    expect(validateFares('INTERMUNICIPAL', [{ referencePoint: ' ', amount: '5000' }])).toContain('punto de referencia');
  });

  it('INTERMUNICIPAL rechaza puntos de referencia repetidos', () => {
    expect(validateFares('INTERMUNICIPAL', [
      { referencePoint: 'Pasca', amount: '5000' },
      { referencePoint: 'pasca ', amount: '6000' },
    ])).toContain('repetido');
  });

  it('INTERMUNICIPAL rechaza un monto que no es mayor que cero', () => {
    expect(validateFares('INTERMUNICIPAL', [
      { referencePoint: 'Pasca', amount: '5000' },
      { referencePoint: 'Arbeláez', amount: '0' },
    ])).toContain('Tarifa 2');
  });

  it('INTERMUNICIPAL con varias tarifas válidas pasa', () => {
    expect(validateFares('INTERMUNICIPAL', [
      { referencePoint: 'Pasca', amount: '5000' },
      { referencePoint: 'Arbeláez', amount: '4000' },
    ])).toBeNull();
  });
});

describe('buildFares y sortFares', () => {
  it('URBANA manda una sola tarifa sin referencePoint', () => {
    expect(buildFares('URBANA', [{ referencePoint: 'ignorado', amount: '2600' }])).toEqual([{ amount: 2600 }]);
  });

  it('INTERMUNICIPAL sale ordenada por monto, con el punto recortado', () => {
    const fares = buildFares('INTERMUNICIPAL', [
      { referencePoint: ' Pasca ', amount: '5000' },
      { referencePoint: 'Arbeláez', amount: '4000' },
    ]);
    expect(fares).toEqual([
      { amount: 4000, referencePoint: 'Arbeláez' },
      { amount: 5000, referencePoint: 'Pasca' },
    ]);
  });

  it('sortFares deja al final las filas sin monto', () => {
    const rows = sortFares([
      { referencePoint: 'a', amount: '' },
      { referencePoint: 'b', amount: '3000' },
      { referencePoint: 'c', amount: '1000' },
    ]);
    expect(rows.map((r) => r.referencePoint)).toEqual(['c', 'b', 'a']);
  });
});

describe('utilidades', () => {
  it('parseAmount devuelve null si no es un número', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('2600')).toBe(2600);
  });

  it('normalizeKey ignora tildes, mayúsculas y espacios repetidos', () => {
    expect(normalizeKey('  Los   CÁMBULOS ')).toBe('los cambulos');
  });

  it('moveItem sube y baja sin salirse de la lista', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
