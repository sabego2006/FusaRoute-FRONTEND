import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfileComponent } from './profile.component';
import { environment } from '../../../environments/environment';

describe('ProfileComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('se crea y carga el perfil del usuario', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    const req = http.expectOne(`${environment.apiUrl}/api/users/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 1, name: 'Gladys', email: 'gladys@fusaroute.co', phone: '3101234567' });
    fixture.detectChanges();

    expect(fixture.componentInstance.profileForm.value.name).toBe('Gladys');
    expect(fixture.componentInstance.profileForm.value.email).toBe('gladys@fusaroute.co');
    expect(fixture.componentInstance.profileForm.value.phone).toBe('3101234567');
  });

  it('muestra errores por campo del backend al guardar perfil', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    fixture.detectChanges();

    // Los valores pasan los Validators del formulario; el backend rechaza con 400
    fixture.componentInstance.profileForm.patchValue({ email: 'otro@fusaroute.co' });
    fixture.componentInstance.saveProfile();

    const req = http.expectOne(`${environment.apiUrl}/api/users/me`);
    req.flush(
      {
        type: 'about:blank', title: 'Bad Request', status: 400,
        detail: 'Datos inválidos',
        errors: [{ field: 'email', message: 'formato de correo inválido' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.fieldError('email')).toBe('formato de correo inválido');
  });

  it('muestra error 409 al duplicar correo', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    fixture.detectChanges();

    fixture.componentInstance.saveProfile();

    http.expectOne(`${environment.apiUrl}/api/users/me`).flush(
      { type: 'about:blank', title: 'Conflict', status: 409, detail: 'Ya existe' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.profileError()).toContain('ya se encuentra registrado');
  });
});
