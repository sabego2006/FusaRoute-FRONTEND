import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoginComponent } from './login.component';
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

  it('no envía el formulario si es inválido', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    // Formulario vacío
    fixture.componentInstance.onSubmit();

    // No debe haber ninguna petición HTTP
    http.expectNone(`${environment.apiUrl}/api/auth/login`);
  });
});
