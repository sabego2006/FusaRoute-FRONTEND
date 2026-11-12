import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { adminGuard } from './admin.guard';
import { AuthService } from '../../services/auth.service';
import { UserSummary } from '../../models/auth.model';
import { ToastService } from '../../components/toast/toast.service';

/**
 * Guard de rol del panel de administrador (SCRUM-103).
 *
 * Lo que se verifica aqui es la REDIRECCION, que es todo lo que el guard hace. Que un
 * USER no pueda LEER los comentarios de los demas lo garantiza Spring Security en el
 * backend, y eso se prueba alla (AdminCommentControllerTest): este guard solo evita
 * que alguien aterrice en una pantalla que no le va a funcionar.
 */
describe('adminGuard', () => {
  let auth: AuthService;
  let router: Router;

  const admin: UserSummary = { id: 1, name: 'Admin', email: 'a@f.co', role: 'ADMIN', active: true };
  const usuario: UserSummary = { id: 7, name: 'Ana', email: 'ana@f.co', role: 'USER', active: true };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  /** Sesion valida: token con vencimiento en el futuro. */
  function iniciarSesion(user: UserSummary): void {
    auth.applySession({
      token: 'jwt',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user,
    });
  }

  function ejecutar(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never)) as boolean | UrlTree;
  }

  it('deja pasar a un administrador', () => {
    iniciarSesion(admin);

    expect(ejecutar()).toBe(true);
  });

  it('manda al login a quien no tiene sesion, porque iniciarla puede resolverlo', () => {
    const resultado = ejecutar();

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/login');
  });

  it('a un administrador no le muestra ningun aviso', () => {
    iniciarSesion(admin);

    ejecutar();

    expect(TestBed.inject(ToastService).current()).toBeNull();
  });

  /**
   * Con sesion pero sin rol se manda al buscador y NO al login: volver a iniciar
   * sesion con la misma cuenta no cambiaria nada y seria un bucle que no explica nada.
   */
  it('manda al buscador a un usuario con sesion pero sin rol de administrador', () => {
    iniciarSesion(usuario);

    const resultado = ejecutar();

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/rutas/buscar');
  });

  /** Sin el aviso, la redireccion pareceria un enlace roto. */
  it('le explica con un aviso breve por que no entro', () => {
    iniciarSesion(usuario);

    ejecutar();

    expect(TestBed.inject(ToastService).current()?.message)
      .toBe('Esa sección es solo para administradores.');
  });

  /** A quien no tiene sesion lo explica la propia pantalla de login: sin aviso. */
  it('a quien no tiene sesion no le muestra el aviso de administradores', () => {
    ejecutar();

    expect(TestBed.inject(ToastService).current()).toBeNull();
  });

  /**
   * Un token vencido no vale aunque el usuario guardado sea ADMIN: el guard pregunta
   * primero por la sesion.
   */
  it('con el token vencido manda al login aunque el usuario guardado sea administrador', () => {
    auth.applySession({
      token: 'jwt',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      user: admin,
    });

    expect(router.serializeUrl(ejecutar() as UrlTree)).toBe('/login');
  });
});
