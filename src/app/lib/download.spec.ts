import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from './download';

describe('downloadText', () => {
  afterEach(() => vi.restoreAllMocks());

  it('crea una ancla con el nombre de archivo, la clickea y libera la URL', () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadText('codigos.txt', 'AAAA-1111\nBBBB-2222');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
