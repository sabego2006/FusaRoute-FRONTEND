import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminMetricsComponent } from './admin-metrics.component';
import { AdminMetrics } from '../../../models/admin-metrics.model';
import { environment } from '../../../../environments/environment';

describe('AdminMetricsComponent', () => {
  let fixture: ComponentFixture<AdminMetricsComponent>;
  let http: HttpTestingController;
  let root: HTMLElement;
  const url = `${environment.apiUrl}/api/admin/metrics`;

  const base: AdminMetrics = {
    totalUsers: 1234567,
    searchesToday: 37,
    topRoutes: [],
    pendingComments: 4,
    activeSuspensions: 2,
    generatedAt: '2026-11-13T10:15:30-05:00',
    timezone: 'America/Bogota',
    topRoutesWindowDays: 30,
  };

  const ruta = (n: number) => ({ routeId: n, routeName: `Ruta ${n}`, searches: 100 - n });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminMetricsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminMetricsComponent);
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  function abrir(m: Partial<AdminMetrics> = {}): void {
    fixture.detectChanges();
    http.expectOne(url).flush({ ...base, ...m });
    fixture.detectChanges();
  }

  const texto = () => (root.textContent ?? '').replace(/\s+/g, ' ').replace(/[  ]/g, ' ');

  it('mientras carga: esqueleto oculto a lectores y un status con texto', () => {
    fixture.detectChanges();

    expect(root.querySelector('[role="status"]')?.textContent).toContain('Cargando');
    expect(root.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    http.expectOne(url).flush(base);
  });

  it('pinta las 5 métricas, con separador de miles en es-CO', () => {
    abrir({ topRoutes: [ruta(1)] });

    const t = texto();
    expect(t).toContain('Usuarios registrados');
    expect(t).toContain('Búsquedas de hoy');
    expect(t).toContain('Comentarios pendientes');
    expect(t).toContain('Suspensiones activas');
    expect(t).toContain('Las 5 rutas más consultadas');
    expect(t).toContain('1.234.567');
    expect(root.querySelectorAll('section').length).toBe(5);
  });

  it.each([0, 1, 5])('ranking de %i filas', (n) => {
    abrir({ topRoutes: Array.from({ length: n }, (_, i) => ruta(i + 1)) });

    expect(root.querySelectorAll('.fr-ranking__fila').length).toBe(n);
    if (n === 0) {
      expect(texto()).toContain('Aún no hay búsquedas registradas');
    } else {
      const enlace = root.querySelector<HTMLAnchorElement>('.fr-ranking__nombre');
      expect(enlace?.getAttribute('href')).toBe('/rutas/1');
    }
  });

  it('rotula el ranking con la ventana que manda el backend', () => {
    abrir({ topRoutesWindowDays: 30 });

    expect(texto()).toContain('Últimos 30 días');
  });

  it('comentarios pendientes enlaza a /admin/comentarios y suspensiones aún no enlaza', () => {
    abrir();

    const hrefs = Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/admin/comentarios');
    // La sección de suspensiones sigue "Próximamente" en ADMIN_SECTIONS.
    expect(hrefs).not.toContain('/admin/suspensiones');
  });

  /** 04:59Z es 23:59 del día anterior en Colombia (UTC-5), sin importar la zona del navegador. */
  it('muestra la hora de Colombia en un borde de día', () => {
    abrir({ generatedAt: '2026-11-12T04:59:00Z' });

    expect(texto()).toMatch(/Actualizado a las 11:59 p\. ?m\. \(hora de Colombia\)/);
  });

  it('Recargar vuelve a pedir los datos', () => {
    abrir();
    const boton = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Recargar'));

    boton?.click();
    fixture.detectChanges();
    http.expectOne(url).flush({ ...base, searchesToday: 38 });
    fixture.detectChanges();

    expect(texto()).toContain('38');
  });

  /** Sin polling: pasan 10 minutos y no sale ninguna petición más. */
  it('no vuelve a pedir datos por sí solo', () => {
    vi.useFakeTimers();
    try {
      abrir();
      vi.advanceTimersByTime(10 * 60_000);
      fixture.detectChanges();

      http.expectNone(url);
    } finally {
      vi.useRealTimers();
    }
  });

  it('403: mensaje de permiso, sin reintento', () => {
    fixture.detectChanges();
    http.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('No tienes permiso de administrador');
    expect(root.querySelector('button')).toBeNull();
  });

  it('error genérico: alerta con reintento que vuelve a pedir', () => {
    fixture.detectChanges();
    http.expectOne(url).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    root.querySelector('button')?.click();
    fixture.detectChanges();
    http.expectOne(url).flush(base);
  });
});
