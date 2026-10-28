import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('escribe en el portapapeles y devuelve true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    expect(await copyText('JBSWY3DP')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('JBSWY3DP');
  });

  it('devuelve false si el navegador rechaza la escritura', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denegado')) },
    });
    expect(await copyText('x')).toBe(false);
  });

  it('devuelve false si no hay API de portapapeles', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyText('x')).toBe(false);
  });
});
