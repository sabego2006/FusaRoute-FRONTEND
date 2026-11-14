import { createHmac } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decodifica base32 (RFC 4648), tolerando espacios, minúsculas y relleno `=`. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error('Secreto TOTP no es base32 válido');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Código TOTP (RFC 6238): HMAC-SHA1, paso de 30 s, 6 dígitos por defecto. */
export function totp(secretBase32: string, atMs: number = Date.now(), digits = 6, stepSeconds = 30): string {
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

/**
 * Segundos que le quedan al código actual. Sirve para esperar al siguiente paso cuando
 * el backend rechaza reusar el mismo código en la misma ventana.
 */
export function secondsLeftInStep(atMs: number = Date.now(), stepSeconds = 30): number {
  return stepSeconds - ((atMs / 1000) % stepSeconds);
}
