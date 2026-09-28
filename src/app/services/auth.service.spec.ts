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
