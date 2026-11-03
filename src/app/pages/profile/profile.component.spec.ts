import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProfileComponent } from './profile.component';
import { ToastService } from '../../components/toast/toast.service';
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

  const totpUrl = `${environment.apiUrl}/api/users/me/totp`;

  /** Al montar, el perfil también consulta el estado de la verificación en dos pasos. */
  function flushTotpStatus(enabled = true) {
    http.expectOne(totpUrl).flush({ enabled });
  }

  it('muestra la verificación en dos pasos como activada, sin opción de desactivar', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(true);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Verificación en dos pasos');
    expect(text).toContain('Activada');
    expect(text).not.toMatch(/desactivar/i);
  });

  it('re-enrolar monta el enrolamiento y, al terminar, vuelve a la vista de estado', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(true);

    fixture.componentInstance.reenrolling.set(true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-totp-enroll')).not.toBeNull();
    http.expectOne(`${totpUrl}/enroll`).flush({
      secret: 'S', otpauthUri: 'otpauth://totp/x', qrPngBase64: 'AAAA',
    });

    fixture.componentInstance.onReenrolled();
    flushTotpStatus(true);
    fixture.detectChanges();

    expect(fixture.componentInstance.reenrolling()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-totp-enroll')).toBeNull();
  });

  it('ofrece regenerar los códigos de respaldo solo con la verificación activada', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(false);
    fixture.detectChanges();

    // Sin factor activo no hay nada que respaldar: el backend responde 409.
    expect((fixture.nativeElement as HTMLElement).textContent ?? '')
      .not.toContain('Códigos de respaldo');
  });

  it('regenerar muestra los códigos nuevos una sola vez', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(true);
    fixture.detectChanges();

    fixture.componentInstance.regenerateRecoveryCodes();
    http.expectOne(`${totpUrl}/recovery-codes`).flush({
      recoveryCodes: ['AAAA1111BB', 'CCCC2222DD'],
    });
    fixture.detectChanges();

    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).toContain('AAAA1111BB');
    expect(text()).toContain('CCCC2222DD');
    expect(text()).toContain('no se volverán a mostrar');

    // "Ya los guardé" los descarta: no quedan pintados en la vista.
    fixture.componentInstance.newRecoveryCodes.set(null);
    fixture.detectChanges();
    expect(text()).not.toContain('AAAA1111BB');
  });

  it('muestra el error del backend si no se pueden regenerar', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(true);
    fixture.detectChanges();

    fixture.componentInstance.regenerateRecoveryCodes();
    http.expectOne(`${totpUrl}/recovery-codes`).flush(
      { type: 'about:blank', title: 'Conflict', status: 409, detail: 'El segundo factor no esta activo' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.recoveryCodesError()).toBe('El segundo factor no esta activo');
    expect(fixture.componentInstance.newRecoveryCodes()).toBeNull();
  });

  it('si el backend no manda detail, muestra el mensaje genérico', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(true);
    fixture.detectChanges();

    fixture.componentInstance.regenerateRecoveryCodes();
    http.expectOne(`${totpUrl}/recovery-codes`).flush(null, { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    expect(fixture.componentInstance.recoveryCodesError()).toBe('No pudimos generar códigos nuevos. Inténtalo de nuevo.');
  });

  it('el botón "Generar códigos de respaldo nuevos" dispara la regeneración', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const boton = [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Generar códigos de respaldo nuevos'));
    boton?.dispatchEvent(new Event('click'));

    http.expectOne(`${totpUrl}/recovery-codes`).flush({ recoveryCodes: ['AAAA1111BB'] });
    fixture.detectChanges();

    expect(fixture.componentInstance.newRecoveryCodes()).toEqual(['AAAA1111BB']);
  });

  it('copiar códigos avisa con éxito cuando el portapapeles funciona', async () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(true);
    fixture.componentInstance.newRecoveryCodes.set(['AAAA1111BB']);

    const toast = TestBed.inject(ToastService);
    const showSpy = vi.spyOn(toast, 'show');
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    await fixture.componentInstance.copyRecoveryCodes();

    expect(writeText).toHaveBeenCalledWith('AAAA1111BB');
    expect(showSpy).toHaveBeenCalledWith('Códigos copiados', 'success');
    vi.unstubAllGlobals();
  });

  it('copiar códigos avisa el fallo cuando el portapapeles lo bloquea', async () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(true);
    fixture.componentInstance.newRecoveryCodes.set(['AAAA1111BB']);

    const toast = TestBed.inject(ToastService);
    const showSpy = vi.spyOn(toast, 'show');
    const writeText = vi.fn().mockRejectedValue(new Error('bloqueado'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    await fixture.componentInstance.copyRecoveryCodes();

    expect(showSpy).toHaveBeenCalledWith('No se pudo copiar', 'error');
    vi.unstubAllGlobals();
  });

  it('descargar códigos genera un archivo de texto con los códigos vigentes', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/users/me`).flush({
      id: 1, name: 'G', email: 'g@f.co', phone: null,
    });
    flushTotpStatus(true);
    fixture.componentInstance.newRecoveryCodes.set(['AAAA1111BB', 'CCCC2222DD']);

    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    fixture.componentInstance.downloadRecoveryCodes();

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('se crea y carga el perfil del usuario', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    flushTotpStatus();

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
    flushTotpStatus();
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
    flushTotpStatus();
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
