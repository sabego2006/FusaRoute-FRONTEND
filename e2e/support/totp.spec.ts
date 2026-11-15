import { expect, test } from '@playwright/test';
import { totp } from './totp';

// Vectores de RFC 6238 (apéndice B), SHA-1, secreto ASCII "12345678901234567890"
// en base32, truncados a 6 dígitos.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test.describe('totp (RFC 6238)', () => {
  const vectors: [number, string][] = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ];
  for (const [seconds, expected] of vectors) {
    test(`t=${seconds}s → ${expected}`, () => {
      expect(totp(RFC_SECRET, seconds * 1000)).toBe(expected);
    });
  }
});
