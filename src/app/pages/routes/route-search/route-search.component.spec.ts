import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { RouteSearchComponent } from './route-search.component';
import { RouteService } from '../../../services/route.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { RouteSearchResult, RouteSign } from '../../../models/route.model';

const conTrazado: RouteSearchResult = {
  route: {
    id: 4,
    name: 'Camino Real - La Pampa',
    type: 'URBANA',
    neighborhoods: ['Camino Real', 'La Pampa'],
    fares: []
  },
  estimatedMinutes: 18,
  travelDistanceInMeters: 2400,
  boarding: { latitude: 4.343, longitude: -74.3658, distanceInMeters: 240, walkingMinutes: 3 },
  dropOff: { latitude: 4.33, longitude: -74.3602, distanceInMeters: 90, walkingMinutes: 1 },
  signs: []
};

/** Caso real de V11 (SCRUM-176). */
const letreroArbelaez: RouteSign = {
  fieldId: 'LC-025',
  sense: null,
  sourcePhoto: '20260927_152133.jpg',
  evidenceCrop: '20260927_152133.jpg',
  observedOn: '2026-09-27',
  plates: [
    { template: 'PLACA_ARCO', code: null, lines: [{ text: 'ARBELAEZ', background: '#C23A32', foreground: '#FFFFFF' }] }
  ]
};

/** Lo que devuelve el endpoint offline: nunca trae tiempo estimado. */
const sinRed: RouteSearchResult = { ...conTrazado, estimatedMinutes: null };

/** Hoy la mayoría de las rutas sembradas no tiene GeoJSON cargado. */
const sinTrazado: RouteSearchResult = {
  ...conTrazado,
  travelDistanceInMeters: null,
  boarding: null,
  dropOff: null
};

interface Opciones {
  online?: boolean;
  searchRoute?: () => unknown;
  searchRouteOffline?: () => unknown;
}

async function render(opciones: Opciones) {
  const searchRoute = vi.fn(opciones.searchRoute ?? (() => of(conTrazado)));
  const searchRouteOffline = vi.fn(opciones.searchRouteOffline ?? (() => of(sinRed)));

  await TestBed.configureTestingModule({
    imports: [RouteSearchComponent],
    providers: [
      { provide: RouteService, useValue: { searchRoute, searchRouteOffline } },
      { provide: ConnectivityService, useValue: { isOnline: signal(opciones.online ?? true) } }
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(RouteSearchComponent);
  fixture.componentInstance.searchForm.setValue({
    originNeighborhood: 'Camino Real',
    originLat: 4.3433,
    originLng: -74.3661,
    destinationNeighborhood: 'La Pampa',
    destinationLat: 4.33,
    destinationLng: -74.36
  });
  fixture.detectChanges();

  const triggerSearch = async () => {
    fixture.componentInstance.onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  return { triggerSearch, searchRoute, searchRouteOffline, el: fixture.nativeElement as HTMLElement };
}

describe('RouteSearchComponent', () => {
  it('with network uses online endpoint and shows estimated time', async () => {
    const { triggerSearch, searchRoute, searchRouteOffline, el } = await render({ online: true });

    await triggerSearch();

    expect(searchRoute).toHaveBeenCalledOnce();
    expect(searchRouteOffline).not.toHaveBeenCalled();
    expect(el.textContent).toContain('18 min');
    expect(el.textContent).toContain('tiempo estimado');
  });

  it('with more than 7 neighborhoods shows 7 steps, with first and last (RF-05)', async () => {
    const neighborhoods = Array.from({ length: 12 }, (_, i) => `Neighborhood ${i + 1}`);
    const longRoute: RouteSearchResult = {
      ...conTrazado,
      route: { ...conTrazado.route, neighborhoods: neighborhoods }
    };
    const { triggerSearch, el } = await render({ online: true, searchRoute: () => of(longRoute) });

    await triggerSearch();

    const steps = Array.from(el.querySelectorAll('.barrio')).map((n) => n.textContent?.trim());
    expect(steps).toHaveLength(7);
    expect(steps[0]).toBe('Neighborhood 1');
    expect(steps[6]).toBe('Neighborhood 12');
  });

  it('shows last mile: where to take it and how much remains on drop-off', async () => {
    const { triggerSearch, el } = await render({ online: true });

    await triggerSearch();

    expect(el.textContent).toContain('240 m');
    expect(el.textContent).toContain('3 min');
    expect(el.textContent).toContain('90 m');
  });

  it('without network uses offline endpoint and DOES NOT invent estimated time', async () => {
    const { triggerSearch, searchRoute, searchRouteOffline, el } = await render({ online: false });

    await triggerSearch();

    expect(searchRouteOffline).toHaveBeenCalledOnce();
    expect(searchRoute).not.toHaveBeenCalled();
    expect(el.textContent).not.toContain('tiempo estimado');
    expect(el.textContent).toContain('2.4 km');
    expect(el.textContent).toContain('recorrido en buseta');
  });

  it('without network warns before searching that there will be no travel time', async () => {
    const { el } = await render({ online: false });

    expect(el.textContent).toContain('Estás sin conexión');
  });

  it('if network fails despite browser reporting it as good, retry offline', async () => {
    // navigator.onLine says there is a network interface, not that there is internet. If the
    // call does not leave the machine (status 0), the user should not see an
    // error: the offline endpoint does not need to go to Google.
    const { triggerSearch, searchRouteOffline, el } = await render({
      online: true,
      searchRoute: () => throwError(() => new HttpErrorResponse({ status: 0 }))
    });

    await triggerSearch();

    expect(searchRouteOffline).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('recorrido en buseta');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('a route without a path is still suggested, warning that there is no boarding point', async () => {
    const { triggerSearch, el } = await render({ online: true, searchRoute: () => of(sinTrazado) });

    await triggerSearch();

    expect(el.textContent).toContain('Camino Real - La Pampa');
    expect(el.textContent).toContain('no tiene su trazado cargado');
  });

  it('con letrero fotografiado en el resultado, lo muestra (criterio de aceptación SCRUM-176)', async () => {
    const { triggerSearch, el } = await render({
      online: true,
      searchRoute: () => of({ ...conTrazado, signs: [letreroArbelaez] })
    });

    await triggerSearch();

    expect(el.textContent).toContain('Letrero de la buseta');
    expect(el.querySelector('app-letrero')).not.toBeNull();
    expect(el.textContent).toContain('ARBELAEZ');
  });

  it('sin evidencia de campo para la ruta sugerida, no muestra la sección del letrero', async () => {
    const { triggerSearch, el } = await render({ online: true });

    await triggerSearch();

    expect(el.textContent).not.toContain('Letrero de la buseta');
    expect(el.querySelector('app-letrero')).toBeNull();
  });

  it('when no route connects the neighborhoods, show the backend message', async () => {
    const { triggerSearch, el } = await render({
      online: true,
      searchRoute: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              error: { detail: 'No hay rutas disponibles que conecten Centro con Pasca' }
            })
        )
    });

    await triggerSearch();

    expect(el.textContent).toContain('No hay rutas disponibles que conecten Centro con Pasca');
  });
});
