import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMobileDevice } from './device';

describe('isMobileDevice', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('es true con puntero táctil', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
    expect(isMobileDevice()).toBe(true);
  });

  it('es false con puntero de precisión (escritorio)', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(isMobileDevice()).toBe(false);
  });

  it('es false si matchMedia no existe', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(isMobileDevice()).toBe(false);
  });
});
