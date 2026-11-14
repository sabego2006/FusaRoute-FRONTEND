import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SuspensionNoticesComponent } from './suspension-notices.component';
import { AuthService } from '../../services/auth.service';
import { UserNotification } from '../../models/notification.model';
import { environment } from '../../../environments/environment';

const url = `${environment.apiUrl}/api/users/me/notifications`;
const aviso: UserNotification = {
  type: 'ROUTE_SUSPENDED', suspensionId: 7, routeId: 12, routeName: 'Centro - Terminal',
  startsAt: '2026-11-20T13:00:00Z', endsAt: '2026-11-23T01:00:00Z', reason: 'Obras en la Cra. 6', because: 'FAVORITE',
};

describe('SuspensionNoticesComponent', () => {
  let http: HttpTestingController;
  const logged = signal(true);

  async function abrir() {
    const fixture = TestBed.createComponent(SuspensionNoticesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }
  const settle = async (f: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
  };

  beforeEach(() => {
    sessionStorage.clear();
    logged.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: logged } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('con sesión muestra el aviso con ruta, fecha de Colombia, motivo y por qué', async () => {
    const f = await abrir();
    http.expectOne(url).flush([aviso]);
    await settle(f);
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(el.textContent).toContain('La ruta Centro - Terminal está suspendida hasta el 22 de noviembre de 2026');
    expect(el.textContent).toContain('20:00');
    expect(el.textContent).toContain('Motivo: Obras en la Cra. 6');
    expect(el.textContent).toContain('es tu destino favorito');
  });

  it('FREQUENT dice que la usa seguido y sin motivo no lo muestra', async () => {
    const f = await abrir();
    http.expectOne(url).flush([{ ...aviso, because: 'FREQUENT', reason: null }]);
    await settle(f);
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('la usas seguido');
    expect(el.textContent).not.toContain('Motivo:');
  });

  it('se descarta, queda guardado en la sesión y no se repite', async () => {
    const f = await abrir();
    http.expectOne(url).flush([aviso]);
    await settle(f);
    const el = f.nativeElement as HTMLElement;
    (el.querySelector('button') as HTMLButtonElement).click();
    await settle(f);
    expect(el.textContent).not.toContain('está suspendida');
    expect(sessionStorage.getItem('fusaroute.aviso-suspension.7')).toBe('1');

    // Un componente nuevo en la misma sesión no vuelve a mostrarlo.
    const g = await abrir();
    http.expectOne(url).flush([aviso]);
    await settle(g);
    expect((g.nativeElement as HTMLElement).textContent).not.toContain('está suspendida');
  });

  it('sin sesión no llama al backend', async () => {
    logged.set(false);
    const f = await abrir();
    http.expectNone(url);
    expect((f.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });

  it('una falla de red no muestra nada ni error', async () => {
    const f = await abrir();
    http.expectOne(url).error(new ProgressEvent('error'));
    await settle(f);
    expect((f.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});
