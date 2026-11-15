import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AdminCredentials {
  email: string;
  password: string;
  totpSecret: string;
}

/**
 * Credenciales del admin de DEV: variables de entorno o `.admin.local.json`
 * (ignorado por git). Devuelve `null` si faltan, y la suite se salta con un mensaje.
 * Nunca se imprime el secreto.
 */
export function loadAdminCredentials(): AdminCredentials | null {
  const env = process.env;
  if (env['ADMIN_EMAIL'] && env['ADMIN_PASSWORD'] && env['ADMIN_TOTP_SECRET']) {
    return { email: env['ADMIN_EMAIL'], password: env['ADMIN_PASSWORD'], totpSecret: env['ADMIN_TOTP_SECRET'] };
  }
  const file = resolve(process.cwd(), env['ADMIN_LOCAL_JSON'] ?? '.admin.local.json');
  if (existsSync(file)) {
    try {
      const j = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
      const email = j['email'] ?? j['ADMIN_EMAIL'];
      const password = j['password'] ?? j['ADMIN_PASSWORD'];
      const totpSecret = j['totpSecret'] ?? j['totp_secret'] ?? j['ADMIN_TOTP_SECRET'];
      if (email && password && totpSecret) return { email, password, totpSecret };
    } catch { /* JSON inválido: se trata como ausente */ }
  }
  return null;
}

export const SKIP_REASON =
  'Faltan credenciales del admin de DEV (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_TOTP_SECRET o .admin.local.json). Ver docs/pruebas-e2e-admin.md.';
