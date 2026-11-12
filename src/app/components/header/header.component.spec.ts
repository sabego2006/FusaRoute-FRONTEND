import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HeaderComponent } from './header.component';
import { AuthService } from '../../services/auth.service';
import { UserSummary } from '../../models/auth.model';
import { environment } from '../../../environments/environment';

/**
 * Barra de navegación, con foco en el contador de respuestas nuevas (RF-14, SCRUM-102).
 *
 * El contador es el entregable visible de esa subtarea, así que lo que se comprueba es
 * lo que ve el usuario: que el globito aparezca con un número, que no aparezca en cero,
 * y que la petición se haga solo cuando hay sesión.
 */
describe('HeaderComponent', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  const unreadUrl = `${environment.apiUrl}/api/comments/me/unread-count`;

  const usuario: UserSummary = { id: 7, name: 'Ana', email: 'ana@f.co', role: 'USER', active: true };
  const admin: UserSummary = { id: 1, name: 'Admin', email: 'a@f.co', role: 'ADMIN', active: true };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  function iniciarSesion(user: UserSummary): void {
    auth.applySession({
      token: 'jwt',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user,
    });
  }

  function texto(fixture: ComponentFixture<HeaderComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function globito(fixture: ComponentFixture<HeaderComponent>): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.fr-aviso');
  }

  /** Monta el encabezado con sesión y resuelve el conteo que pide al arrancar. */
  function montarConSesion(count: number, user: UserSummary = usuario): ComponentFixture<HeaderComponent> {
    iniciarSesion(user);
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    http.expectOne(unreadUrl).flush({ count });
    fixture.detectChanges();
    return fixture;
  }

  it('sin sesión no muestra el enlace de comentarios ni pide el conteo', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    expect(texto(fixture)).not.toContain('Comentarios');
    expect(texto(fixture)).toContain('Ingresar');
    // Sin petición: lo confirma http.verify() del afterEach.
  });

  it('con sesión muestra el enlace de comentarios', () => {
    const fixture = montarConSesion(0);

    expect(texto(fixture)).toContain('Comentarios');
    expect(texto(fixture)).toContain('Hola, Ana');
  });

  it('muestra el globito con el número de respuestas nuevas', () => {
    const fixture = montarConSesion(3);

    expect(globito(fixture)?.textContent?.trim()).toBe('3');
  });

  /** Cero respuestas no es un aviso: un globito con "0" sería ruido. */
  it('en cero no muestra globito', () => {
    const fixture = montarConSesion(0);

    expect(globito(fixture)).toBeNull();
  });

  /**
   * El número tiene que llegarle también a quien usa lector de pantalla: el globito va
   * en `aria-hidden` y el enlace lleva el conteo en su `aria-label`.
   */
  it('el conteo queda en el aria-label del enlace, no solo en el globito', () => {
    const fixture = montarConSesion(2);

    const enlace = (fixture.nativeElement as HTMLElement)
      .querySelector('.fr-header__link--con-aviso') as HTMLElement;
    expect(enlace.getAttribute('aria-label')).toBe('Comentarios, 2 respuestas nuevas');
    expect(globito(fixture)?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sin respuestas nuevas el aria-label no menciona ningún número', () => {
    const fixture = montarConSesion(0);

    const enlace = (fixture.nativeElement as HTMLElement)
      .querySelector('.fr-header__link--con-aviso') as HTMLElement;
    expect(enlace.getAttribute('aria-label')).toBe('Comentarios');
  });

  /**
   * Si el conteo falla, el encabezado sigue funcionando sin globito. Es un adorno:
   * tumbar la navegación de toda la aplicación por él sería desproporcionado.
   */
  it('si el conteo falla el encabezado se pinta igual, sin globito', () => {
    iniciarSesion(usuario);
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    http.expectOne(unreadUrl).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Comentarios');
    expect(globito(fixture)).toBeNull();
  });

  // --- Enlace a la administración (SCRUM-103, SCRUM-23) -----------------------

  function enlaceAdmin(fixture: ComponentFixture<HeaderComponent>): HTMLAnchorElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'))
      .find((a) => (a.textContent ?? '').trim() === 'Administración');
  }

  it('sin sesión no hay enlace a la administración', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    expect(enlaceAdmin(fixture)).toBeUndefined();
  });

  it('un usuario normal no ve el enlace a la administración', () => {
    const fixture = montarConSesion(0, usuario);

    expect(enlaceAdmin(fixture)).toBeUndefined();
  });

  /**
   * Que el enlace aparezca es comodidad, no seguridad: el backend exige rol ADMIN en
   * `/api/admin/**` y responde 403 a cualquier otro.
   */
  it('un administrador ve el enlace a la administración, que abre /admin', () => {
    const fixture = montarConSesion(0, admin);

    expect(enlaceAdmin(fixture)?.getAttribute('href')).toBe('/admin');
  });

  it('al cerrar sesión el administrador deja de ver el enlace', () => {
    const fixture = montarConSesion(0, admin);

    auth.logout();
    fixture.detectChanges();

    expect(enlaceAdmin(fixture)).toBeUndefined();
  });

  it('al cerrar sesión desaparece el enlace de comentarios y el globito', () => {
    const fixture = montarConSesion(4);
    expect(globito(fixture)).not.toBeNull();

    auth.logout();
    fixture.detectChanges();

    expect(texto(fixture)).not.toContain('Comentarios');
    expect(globito(fixture)).toBeNull();
  });
});
