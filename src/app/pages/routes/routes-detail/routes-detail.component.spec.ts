import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { throwError, of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { RoutesDetailComponent } from './routes-detail.component';
import { RouteService } from '../../../services/route.service';
import { Route } from '../../../models/route.model';

async function render(getRouteById: () => unknown, id: string | null = '1') {
  await TestBed.configureTestingModule({
    imports: [RoutesDetailComponent],
    providers: [
      provideRouter([]),
      { provide: RouteService, useValue: { getRouteById } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } }
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(RoutesDetailComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const urbana: Route = {
  id: 1,
  name: 'Camino Real - La Pampa',
  type: 'URBANA',
  neighborhoods: ['Camino Real', 'Centro', 'La Pampa'],
  fares: [{ referencePoint: null, amount: 2600, validFrom: '2026-02-05' }]
};

const intermunicipal: Route = {
  id: 8,
  name: 'Fusagasugá - Pasca',
  type: 'INTERMUNICIPAL',
  neighborhoods: Array.from({ length: 9 }, (_, i) => `Barrio ${i + 1}`),
  fares: [
    { referencePoint: 'Corregimiento', amount: 3000, validFrom: '2025-01-16' },
    { referencePoint: 'Alaska', amount: 3550, validFrom: '2026-02-05' },
    { referencePoint: 'Pasca', amount: 4300, validFrom: '2025-01-16' }
  ]
};

describe('RoutesDetailComponent', () => {
  it('ruta urbana: muestra sus barrios en orden y un único precio con su fecha', async () => {
    const el = await render(() => of(urbana));

    expect(el.querySelector('h1')?.textContent).toContain('Camino Real - La Pampa');
    expect(Array.from(el.querySelectorAll('.barrio')).map((n) => n.textContent?.trim())).toEqual([
      'Camino Real',
      'Centro',
      'La Pampa'
    ]);
    expect(el.textContent).toMatch(/\$\s?2\.600/);
    expect(el.textContent).toContain('5 de febrero de 2026');
    expect(el.querySelector('table')).toBeNull();
  });

  it('ruta intermunicipal: muestra la tabla por punto de referencia, en el orden que llega', async () => {
    const el = await render(() => of(intermunicipal), '8');

    const rows = Array.from(el.querySelectorAll('tbody tr')).map((r) => r.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Corregimiento');
    expect(rows[1]).toContain('Alaska');
    expect(rows[2]).toContain('Pasca');
    expect(rows[1]).toContain('5 de febrero de 2026');
    expect(rows[2]).toContain('16 de enero de 2025');
  });

  it('con más de 7 barrios muestra solo 7, con el primero y el último', async () => {
    const el = await render(() => of(intermunicipal), '8');

    const steps = Array.from(el.querySelectorAll('.barrio')).map((n) => n.textContent?.trim());
    expect(steps).toHaveLength(7);
    expect(steps[0]).toBe('Barrio 1');
    expect(steps[6]).toBe('Barrio 9');
  });

  it('ruta sin tarifa vigente: lo dice en vez de mostrar un precio vacío', async () => {
    const el = await render(() => of({ ...urbana, fares: [] }));

    expect(el.textContent).toContain('Tarifa no disponible');
  });

  it('404 (no existe o está suspendida): mensaje claro y sin detalle', async () => {
    const el = await render(() => throwError(() => new HttpErrorResponse({ status: 404 })), '999');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no existe o no está disponible');
    expect(el.querySelector('article')).toBeNull();
  });

  it('otro error: mensaje genérico de carga', async () => {
    const el = await render(() => throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar');
  });
});
