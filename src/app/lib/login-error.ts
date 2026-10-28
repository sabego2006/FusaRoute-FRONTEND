import { LoginErrorBody } from '../models/auth.model';

/**
 * Estrecha el cuerpo de un 401 de login a `LoginErrorBody`. Devuelve `null` si no es una
 * respuesta de MFA conocida, que es el caso de "credenciales incorrectas".
 */
export function parseLoginError(body: unknown): LoginErrorBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { error, enrollmentToken } = body as Record<string, unknown>;

  if (error === 'TOTP_REQUIRED' || error === 'INVALID_TOTP') return { error };
  if (error === 'TOTP_ENROLLMENT_REQUIRED' && typeof enrollmentToken === 'string') {
    return { error, enrollmentToken };
  }
  return null;
}
