import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

describe('LoginComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('se crea correctamente', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra el error del backend cuando las credenciales son incorrectas', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    fixture.componentInstance.loginForm.patchValue({
      email: 'test@test.com',
      password: 'Wrong1234',
    });
    fixture.componentInstance.onSubmit();

    http.expectOne(`${environment.apiUrl}/api/auth/login`).flush(
      { type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Correo o contraseña incorrectos.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage()).toBe('Correo o contraseña incorrectos.');
    // El mensaje debe ser visible en el DOM
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.fr-alerta')?.textContent).toContain('Correo o contraseña incorrectos.');
  });

  describe('verificación en dos pasos', () => {
    const loginUrl = `${environment.apiUrl}/api/auth/login`;
    const enrollUrl = `${environment.apiUrl}/api/users/me/totp/enroll`;
    const unauthorized = { status: 401, statusText: 'Unauthorized' };

    function submitCredentials() {
      const fixture = TestBed.createComponent(LoginComponent);
      fixture.detectChanges();
      fixture.componentInstance.loginForm.patchValue({ email: 'a@b.co', password: 'Test1234' });
      fixture.componentInstance.onSubmit();
      return fixture;
    }

    function goToTotpStep() {
      const fixture = submitCredentials();
      http.expectOne(loginUrl).flush({ error: 'TOTP_REQUIRED' }, unauthorized);
      fixture.detectChanges();
      return fixture;
    }

    it('éxito: guarda la sesión y navega a /rutas', () => {
      const fixture = submitCredentials();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      http.expectOne(loginUrl).flush({
        token: 'jwt', tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: { id: 1, name: 'A', email: 'a@b.co', role: 'USER', active: true },
      });

      expect(TestBed.inject(AuthService).token()).toBe('jwt');
      expect(navigate).toHaveBeenCalledWith(['/rutas']);
      expect(fixture.componentInstance.step()).toBe('credentials');
    });

    it('TOTP_ENROLLMENT_REQUIRED: guarda el enrollmentToken en memoria y pasa a enrolar', () => {
      const fixture = submitCredentials();
      http.expectOne(loginUrl).flush(
        { error: 'TOTP_ENROLLMENT_REQUIRED', enrollmentToken: 'enroll-token' }, unauthorized,
      );
      fixture.detectChanges();

      expect(fixture.componentInstance.step()).toBe('enroll');
      expect(TestBed.inject(AuthService).enrollmentToken()).toBe('enroll-token');
      expect(localStorage.getItem('token')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-totp-enroll')).not.toBeNull();

      // El componente de enrolamiento pide el QR apenas se monta
      http.expectOne(enrollUrl).flush({ secret: 'S', otpauthUri: 'otpauth://totp/x', qrPngBase64: 'AAAA' });
    });

    it('TOTP_REQUIRED: muestra el paso del código y reenvía correo, contraseña y código', () => {
      const fixture = goToTotpStep();

      expect(fixture.componentInstance.step()).toBe('totp');
      expect(fixture.nativeElement.querySelector('#totp-code')).not.toBeNull();

      fixture.componentInstance.totpForm.patchValue({ code: '123456' });
      fixture.componentInstance.onSubmitTotp();

      const req = http.expectOne(loginUrl);
      expect(req.request.body).toEqual({ email: 'a@b.co', password: 'Test1234', totpCode: '123456' });
      req.flush({ error: 'INVALID_TOTP' }, unauthorized);
    });

    it('INVALID_TOTP: muestra "código incorrecto" y no vuelve al paso 1', () => {
      const fixture = goToTotpStep();
      fixture.componentInstance.totpForm.patchValue({ code: '000000' });
      fixture.componentInstance.onSubmitTotp();

      http.expectOne(loginUrl).flush({ error: 'INVALID_TOTP' }, unauthorized);
      fixture.detectChanges();

      expect(fixture.componentInstance.step()).toBe('totp');
      expect(fixture.componentInstance.errorMessage()).toContain('Código incorrecto');
      expect(fixture.nativeElement.querySelector('#email')).toBeNull();
    });

    it('credenciales inválidas (401 genérico): vuelve al paso 1 con el mensaje', () => {
      const fixture = submitCredentials();
      http.expectOne(loginUrl).flush({ status: 401 }, unauthorized);
      fixture.detectChanges();

      expect(fixture.componentInstance.step()).toBe('credentials');
      expect(fixture.componentInstance.errorMessage()).toBe('Correo o contraseña incorrectos.');
    });

    it('acepta un código de respaldo sin exigir 6 dígitos', () => {
      const fixture = goToTotpStep();

      fixture.componentInstance.toggleBackupCode();
      fixture.componentInstance.totpForm.patchValue({ code: 'ABCD-EFGH' });
      expect(fixture.componentInstance.totpForm.valid).toBe(true);

      fixture.componentInstance.onSubmitTotp();
      const req = http.expectOne(loginUrl);
      expect(req.request.body.totpCode).toBe('ABCD-EFGH');
      req.flush({ error: 'INVALID_TOTP' }, unauthorized);
    });

    it('si vence el enrollmentToken, vuelve al paso 1 y lo descarta', () => {
      const fixture = submitCredentials();
      http.expectOne(loginUrl).flush(
        { error: 'TOTP_ENROLLMENT_REQUIRED', enrollmentToken: 'enroll-token' }, unauthorized,
      );
      fixture.detectChanges();

      http.expectOne(enrollUrl).flush({}, unauthorized);
      fixture.detectChanges();

      expect(fixture.componentInstance.step()).toBe('credentials');
      expect(TestBed.inject(AuthService).enrollmentToken()).toBeNull();
      expect(fixture.componentInstance.errorMessage()).toContain('venció');
    });
  });

  it('no envía el formulario si es inválido', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    // Formulario vacío
    fixture.componentInstance.onSubmit();

    // No debe haber ninguna petición HTTP
    http.expectNone(`${environment.apiUrl}/api/auth/login`);
  });
});
