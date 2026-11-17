import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { LoginResponse } from '../models/auth.model';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('arranca sin sesión', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.token()).toBeNull();
  });

  it('login guarda token, usuario y expiración', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const mockResponse: LoginResponse = {
      token: 'jwt-test-token',
      tokenType: 'Bearer',
      expiresAt: futureDate,
      user: { id: 1, name: 'Gladys', email: 'gladys@fusaroute.co', role: 'USER', active: true },
    };

    service.login({ email: 'gladys@fusaroute.co', password: 'Test1234' }).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/api/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(service.isLoggedIn()).toBe(true);
    expect(service.token()).toBe('jwt-test-token');
    expect(service.currentUser()?.name).toBe('Gladys');
  });

  it('isLoggedIn devuelve false si el token está vencido', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const mockResponse: LoginResponse = {
      token: 'expired-token',
      tokenType: 'Bearer',
      expiresAt: pastDate,
      user: { id: 1, name: 'Gladys', email: 'gladys@fusaroute.co', role: 'USER', active: true },
    };

    service.login({ email: 'gladys@fusaroute.co', password: 'Test1234' }).subscribe();
    http.expectOne(`${environment.apiUrl}/api/auth/login`).flush(mockResponse);

    expect(service.isLoggedIn()).toBe(false);
  });

  it('logout limpia la sesión', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    service.login({ email: 'a@b.co', password: 'x' }).subscribe();
    http.expectOne(`${environment.apiUrl}/api/auth/login`).flush({
      token: 'tk', tokenType: 'Bearer', expiresAt: futureDate,
      user: { id: 1, name: 'A', email: 'a@b.co', role: 'USER', active: true },
    });

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('register llama al endpoint correcto y no guarda sesión', () => {
    service.register({ name: 'N', email: 'n@n.co', password: 'Test1234' }).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/api/auth/register`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 2, name: 'N', email: 'n@n.co' });

    // El registro no inicia sesión
    expect(service.isLoggedIn()).toBe(false);
  });

  it('login envía totpCode cuando se le pasa', () => {
    service.login({ email: 'a@b.co', password: 'x', totpCode: '123456' }).subscribe({ error: () => undefined });

    const req = http.expectOne(`${environment.apiUrl}/api/auth/login`);
    expect(req.request.body).toEqual({ email: 'a@b.co', password: 'x', totpCode: '123456' });
    req.flush({ error: 'INVALID_TOTP' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('el enrollmentToken vive solo en memoria y nunca toca localStorage', () => {
    service.setEnrollmentToken('enroll-token');

    expect(service.enrollmentToken()).toBe('enroll-token');
    expect(JSON.stringify({ ...localStorage })).not.toContain('enroll-token');
    expect(service.isLoggedIn()).toBe(false);
  });

  it('applySession guarda la sesión y descarta el enrollmentToken', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    service.setEnrollmentToken('enroll-token');

    service.applySession({
      token: 'full-token', tokenType: 'Bearer', expiresAt: futureDate,
      user: { id: 1, name: 'A', email: 'a@b.co', role: 'USER', active: true },
    });

    expect(service.enrollmentToken()).toBeNull();
    expect(service.isLoggedIn()).toBe(true);
    expect(localStorage.getItem('token')).toBe('full-token');
  });

  it('logout también descarta el enrollmentToken', () => {
    service.setEnrollmentToken('enroll-token');
    service.logout();
    expect(service.enrollmentToken()).toBeNull();
  });

  // --- Dispositivo de confianza del segundo factor (decisión del 17-nov-2026, SCRUM-196). -

  it('login adjunta el trustToken guardado de una sesión anterior, aunque quien llama no lo pase', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    service.applySession({
      token: 'tk', tokenType: 'Bearer', expiresAt: futureDate,
      user: { id: 1, name: 'A', email: 'a@b.co', role: 'USER', active: true },
      trustToken: 'trust.guardado',
    });

    service.login({ email: 'a@b.co', password: 'x' }).subscribe({ error: () => undefined });

    const req = http.expectOne(`${environment.apiUrl}/api/auth/login`);
    expect(req.request.body).toEqual({ email: 'a@b.co', password: 'x', trustToken: 'trust.guardado' });
    req.flush({ error: 'TOTP_REQUIRED' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('applySession guarda el trustToken nuevo cuando el backend lo entrega', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    service.applySession({
      token: 'tk', tokenType: 'Bearer', expiresAt: futureDate,
      user: { id: 1, name: 'A', email: 'a@b.co', role: 'USER', active: true },
      trustToken: 'trust.nuevo',
    });

    expect(localStorage.getItem('trustToken')).toBe('trust.nuevo');
  });

  it('applySession NO borra el trustToken existente cuando el backend no manda uno nuevo', () => {
    localStorage.setItem('trustToken', 'trust.que-ya-tenia');
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Saltarse el TOTP por confianza no renueva el token (decisión: no se
    // renueva con el uso), así que la respuesta no trae trustToken.
    service.applySession({
      token: 'tk', tokenType: 'Bearer', expiresAt: futureDate,
      user: { id: 1, name: 'A', email: 'a@b.co', role: 'USER', active: true },
    });

    expect(localStorage.getItem('trustToken')).toBe('trust.que-ya-tenia');
  });

  it('logout NO borra el trustToken: el usuario espera no repetir el TOTP en 15 días', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    service.applySession({
      token: 'tk', tokenType: 'Bearer', expiresAt: futureDate,
      user: { id: 1, name: 'A', email: 'a@b.co', role: 'USER', active: true },
      trustToken: 'trust.persistente',
    });

    service.logout();

    expect(localStorage.getItem('trustToken')).toBe('trust.persistente');
  });

  it('patchUserName actualiza el nombre del signal sin HTTP', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    service.login({ email: 'a@b.co', password: 'x' }).subscribe();
    http.expectOne(`${environment.apiUrl}/api/auth/login`).flush({
      token: 'tk', tokenType: 'Bearer', expiresAt: futureDate,
      user: { id: 1, name: 'Viejo', email: 'a@b.co', role: 'USER', active: true },
    });

    service.patchUserName('Nuevo');

    expect(service.currentUser()?.name).toBe('Nuevo');
  });
});
