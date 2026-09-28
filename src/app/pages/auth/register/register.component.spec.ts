import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RegisterComponent } from './register.component';
import { environment } from '../../../../environments/environment';

describe('RegisterComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('se crea correctamente', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra errores por campo del backend', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();

    // Los valores tienen que pasar los Validators del formulario para que onSubmit() haga la petición.
    // El backend es el que rechaza con 400; aquí simulamos esa respuesta.
    fixture.componentInstance.registerForm.patchValue({
      name: 'Gladys',
      email: 'gladys@fusaroute.co',
      password: 'Test1234',
    });
    fixture.componentInstance.onSubmit();

    http.expectOne(`${environment.apiUrl}/api/auth/register`).flush(
      {
        type: 'about:blank', title: 'Bad Request', status: 400,
        detail: 'Datos de registro inválidos',
        errors: [
          { field: 'name', message: 'debe tener entre 2 y 100 caracteres' },
          { field: 'email', message: 'formato de correo inválido' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.fieldError('name')).toBe('debe tener entre 2 y 100 caracteres');
    expect(fixture.componentInstance.fieldError('email')).toBe('formato de correo inválido');

    // Los errores deben aparecer en el DOM
    const compiled = fixture.nativeElement as HTMLElement;
    const errorTexts = Array.from(compiled.querySelectorAll('.fr-ayuda-error')).map(el => el.textContent);
    expect(errorTexts).toContain('debe tener entre 2 y 100 caracteres');
    expect(errorTexts).toContain('formato de correo inválido');
  });

  it('muestra error 409 de correo duplicado', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();

    fixture.componentInstance.registerForm.patchValue({
      name: 'Gladys',
      email: 'gladys@fusaroute.co',
      password: 'Test1234',
    });
    fixture.componentInstance.onSubmit();

    http.expectOne(`${environment.apiUrl}/api/auth/register`).flush(
      { type: 'about:blank', title: 'Conflict', status: 409, detail: 'Ya existe' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.generalError()).toContain('ya se encuentra registrado');
  });

  it('no envía si el formulario es inválido', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();

    // Formulario vacío
    fixture.componentInstance.onSubmit();

    http.expectNone(`${environment.apiUrl}/api/auth/register`);
  });
});
