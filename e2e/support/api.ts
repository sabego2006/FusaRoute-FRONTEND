import { assertBackendLocal, backendUrl } from './guardia';
import { secondsLeftInStep, totp } from './totp';
import type { AdminCredentials } from './credenciales';

export interface UserSummary { id: number; name: string; email: string; role: 'USER' | 'ADMIN'; active: boolean }
export interface Session { token: string; expiresAt: string; user: UserSummary }
export interface TestUser { email: string; password: string; totpSecret: string; session: Session }

export interface ApiResult<T = unknown> { status: number; body: T }

/** Llamada JSON al backend local. Antes de cada una pasa por la guardia anti-PROD. */
export async function api<T = unknown>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  assertBackendLocal();
  const res = await fetch(`${backendUrl()}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* cuerpo no JSON */ }
  return { status: res.status, body: body as T };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * El backend no acepta reusar un código TOTP dentro de su ventana. Si se rechaza el
 * código, se espera al siguiente paso de 30 s (única espera fija: es una restricción
 * del protocolo, no una carrera de la interfaz) y se reintenta una vez.
 */
async function loginWithTotp(email: string, password: string, secret: string): Promise<Session> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await api<Session & { error?: string }>('POST', '/api/auth/login', {
      body: { email, password, totpCode: totp(secret) },
    });
    if (r.status === 200) return r.body;
    if (attempt === 0 && r.status === 401) {
      await sleep(Math.ceil(secondsLeftInStep() * 1000) + 500);
      continue;
    }
    throw new Error(`Login por API falló (${r.status}) para ${email}`);
  }
  throw new Error('Login por API falló');
}

let adminSession: Promise<Session> | null = null;

/** Sesión del admin de DEV, una sola vez por proceso de prueba (evita reusar códigos TOTP). */
export function loginAdmin(cred: AdminCredentials): Promise<Session> {
  adminSession ??= loginWithTotp(cred.email, cred.password, cred.totpSecret);
  return adminSession;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const PREFIX = () => `ZZ-PRUEBA-E2E-${today()}`;

/** Crea un usuario normal con TOTP enrolado, todo por API. No hay borrado de usuarios: queda registrado. */
export async function createNormalUser(): Promise<TestUser> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `zz-prueba-e2e-${stamp}@example.com`;
  const password = 'PruebaE2E1234';
  const reg = await api('POST', '/api/auth/register', {
    body: { name: `${PREFIX()}-${stamp}`, email, password },
  });
  if (reg.status !== 201 && reg.status !== 200) throw new Error(`Registro de prueba falló (${reg.status})`);

  const first = await api<{ error?: string; enrollmentToken?: string }>('POST', '/api/auth/login', {
    body: { email, password },
  });
  if (first.status !== 401 || first.body.error !== 'TOTP_ENROLLMENT_REQUIRED' || !first.body.enrollmentToken) {
    throw new Error(`Se esperaba enrolamiento TOTP obligatorio (recibido ${first.status})`);
  }
  const enrollment = first.body.enrollmentToken;
  const enroll = await api<{ secret: string }>('POST', '/api/users/me/totp/enroll', { token: enrollment, body: {} });
  if (enroll.status !== 200) throw new Error(`Enrolamiento TOTP falló (${enroll.status})`);
  const confirm = await api<Session>('POST', '/api/users/me/totp/confirm', {
    token: enrollment,
    body: { code: totp(enroll.body.secret) },
  });
  if (confirm.status !== 200) throw new Error(`Confirmación TOTP falló (${confirm.status})`);
  return { email, password, totpSecret: enroll.body.secret, session: confirm.body };
}
