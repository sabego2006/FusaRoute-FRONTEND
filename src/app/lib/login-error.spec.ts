import { describe, it, expect } from 'vitest';
import { parseLoginError } from './login-error';

describe('parseLoginError', () => {
  it('reconoce TOTP_REQUIRED e INVALID_TOTP', () => {
    expect(parseLoginError({ error: 'TOTP_REQUIRED' })).toEqual({ error: 'TOTP_REQUIRED' });
    expect(parseLoginError({ error: 'INVALID_TOTP' })).toEqual({ error: 'INVALID_TOTP' });
  });

  it('reconoce TOTP_ENROLLMENT_REQUIRED con su enrollmentToken', () => {
    expect(parseLoginError({ error: 'TOTP_ENROLLMENT_REQUIRED', enrollmentToken: 'abc' })).toEqual({
      error: 'TOTP_ENROLLMENT_REQUIRED',
      enrollmentToken: 'abc',
    });
  });

  it('descarta TOTP_ENROLLMENT_REQUIRED sin enrollmentToken', () => {
    expect(parseLoginError({ error: 'TOTP_ENROLLMENT_REQUIRED' })).toBeNull();
  });

  it('trata un 401 genérico o un cuerpo ajeno como credenciales incorrectas', () => {
    expect(parseLoginError({ status: 401, detail: 'Correo o contraseña incorrectos.' })).toBeNull();
    expect(parseLoginError({ error: 'OTRA_COSA' })).toBeNull();
    expect(parseLoginError(null)).toBeNull();
    expect(parseLoginError('texto')).toBeNull();
  });
});
