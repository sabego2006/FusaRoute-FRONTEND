import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TotpEnrollComponent } from './totp-enroll.component';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

describe('TotpEnrollComponent', () => {
  const base = `${environment.apiUrl}/api/users/me/totp`;
  const enrollment = {
    secret: 'JBSWY3DPEHPK3PXP',
    otpauthUri: 'otpauth://totp/FusaRoute:a@b.co?secret=JBSWY3DPEHPK3PXP',
    qrPngBase64: 'iVBORw0KGgo=',
  };
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TotpEnrollComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  function mount() {
    const fixture = TestBed.createComponent(TotpEnrollComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/enroll`).flush(enrollment);
    fixture.detectChanges();
    return fixture;
  }

  function submitCode(fixture: ReturnType<typeof mount>, code: string) {
    fixture.componentInstance.codeForm.patchValue({ code });
    fixture.componentInstance.confirm();
  }

  it('muestra el QR desde base64, el deep link otpauth y el secret copiable', () => {
    const el: HTMLElement = mount().nativeElement;

    expect(el.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(el.querySelector('a[href^="otpauth://"]')?.textContent).toContain(
      'Abrir mi app autenticadora',
    );
    expect(el.textContent).toContain('JBSWY3DPEHPK3PXP');
  });

  it('no ofrece el deep link si la URI no es otpauth://', () => {
    const fixture = TestBed.createComponent(TotpEnrollComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/enroll`).flush({ ...enrollment, otpauthUri: 'javascript:alert(1)' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('a.fr-btn')).toBeNull();
  });

  it('no deja confirmar un código que no tenga 6 dígitos', () => {
    const fixture = mount();
    submitCode(fixture, '12ab');

    http.expectNone(`${base}/confirm`);
    expect(fixture.componentInstance.codeForm.invalid).toBe(true);
  });

  it('al confirmar deja la sesión iniciada y muestra los códigos de respaldo', () => {
    const fixture = mount();
    const auth = TestBed.inject(AuthService);
    auth.setEnrollmentToken('enroll-token');
    const enrolled = vi.fn();
    fixture.componentInstance.enrolled.subscribe(enrolled);

    submitCode(fixture, '123456');
    http.expectOne(`${base}/confirm`).flush({
      token: 'full-token',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: { id: 1, name: 'A', email: 'a@b.co', role: 'USER', active: true },
      recoveryCodes: ['AAAA-1111', 'BBBB-2222'],
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(auth.token()).toBe('full-token');
    expect(auth.enrollmentToken()).toBeNull();
    expect(el.textContent).toContain('AAAA-1111');
    expect(el.textContent).toContain('no se volverán a mostrar');
    expect(localStorage.getItem('recoveryCodes')).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toContain('AAAA-1111');
    expect(enrolled).not.toHaveBeenCalled();

    (el.querySelector('button.fr-btn-primario') as HTMLButtonElement).click();
    expect(enrolled).toHaveBeenCalledTimes(1);
  });

  it('con un código incorrecto muestra el error y conserva el QR', () => {
    const fixture = mount();
    submitCode(fixture, '000000');

    http
      .expectOne(`${base}/confirm`)
      .flush({ error: 'INVALID_TOTP' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#totp-code-error')?.textContent).toContain('Código incorrecto');
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('emite expired si el enrollmentToken es rechazado al confirmar', () => {
    const fixture = mount();
    TestBed.inject(AuthService).setEnrollmentToken('enroll-token');
    const expired = vi.fn();
    fixture.componentInstance.expired.subscribe(expired);

    submitCode(fixture, '123456');
    http.expectOne(`${base}/confirm`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('permite reintentar si falla la preparación del QR', () => {
    const fixture = TestBed.createComponent(TotpEnrollComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/enroll`).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.fr-alerta')).not.toBeNull();

    (el.querySelector('button.fr-btn') as HTMLButtonElement).click();
    http.expectOne(`${base}/enroll`).flush(enrollment);
  });

  it('copia el secret al portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // Solo se reemplaza `clipboard`: Angular Forms lee navigator.userAgent al crear los inputs.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const fixture = mount();

    await fixture.componentInstance.copySecret();

    expect(writeText).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
  });
});
