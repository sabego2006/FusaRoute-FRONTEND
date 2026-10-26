import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

describe('authInterceptor', () => {
  const totpUrl = `${environment.apiUrl}/api/users/me/totp`;
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => ctrl.verify());

  function sessionResponse(token: string) {
    return {
      token, tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: { id: 1, name: 'A', email: 'a@b.co', role: 'USER' as const, active: true },
    };
  }

  it('adjunta el token completo fuera de /api/auth/', () => {
    auth.applySession(sessionResponse('full-token'));

    http.get(totpUrl).subscribe();

    expect(ctrl.expectOne(totpUrl).request.headers.get('Authorization')).toBe('Bearer full-token');
  });

  it('prefiere el enrollmentToken sobre el token completo', () => {
    auth.applySession(sessionResponse('full-token'));
    auth.setEnrollmentToken('enroll-token');

    http.get(totpUrl).subscribe();

    expect(ctrl.expectOne(totpUrl).request.headers.get('Authorization')).toBe('Bearer enroll-token');
  });

  it('no adjunta ningún token a /api/auth/', () => {
    auth.setEnrollmentToken('enroll-token');

    http.post(`${environment.apiUrl}/api/auth/login`, {}).subscribe({ error: () => undefined });

    const req = ctrl.expectOne(`${environment.apiUrl}/api/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({}, { status: 401, statusText: 'Unauthorized' });
  });

  it('un 401 con sesión completa cierra la sesión y redirige al login', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.applySession(sessionResponse('full-token'));

    http.get(totpUrl).subscribe({ error: () => undefined });
    ctrl.expectOne(totpUrl).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.token()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('un 401 durante el enrolamiento forzado no redirige ni cierra nada', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.setEnrollmentToken('enroll-token');

    http.post(`${totpUrl}/enroll`, {}).subscribe({ error: () => undefined });
    ctrl.expectOne(`${totpUrl}/enroll`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
    expect(auth.enrollmentToken()).toBe('enroll-token');
  });
});
