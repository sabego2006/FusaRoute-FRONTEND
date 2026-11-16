import { afterEach, describe, expect, it, vi } from 'vitest';
import { openUri } from './open-uri';

describe('openUri', () => {
  afterEach(() => vi.restoreAllMocks());

  it('crea una ancla con la URI, la clickea y la retira del documento', () => {
    let clickedHref: string | null = null;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedHref = this.getAttribute('href');
    });

    openUri('otpauth://totp/FusaRoute:a@b.co?secret=JBSWY3DPEHPK3PXP');

    expect(click).toHaveBeenCalledTimes(1);
    expect(clickedHref).toBe('otpauth://totp/FusaRoute:a@b.co?secret=JBSWY3DPEHPK3PXP');
    expect(document.querySelector('a[href^="otpauth://"]')).toBeNull();
  });
});
