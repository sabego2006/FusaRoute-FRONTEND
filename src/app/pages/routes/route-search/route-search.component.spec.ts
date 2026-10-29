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

  const buscar = async () => {
    fixture.componentInstance.onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  return { buscar, searchRoute, searchRouteOffline, el: fixture.nativeElement as HTMLElement };
}

describe('RouteSearchComponent', () => {
  it('con red usa el endpoint online y muestra el tiempo estimado', async () => {
    const { buscar, searchRoute, searchRouteOffline, el } = await render({ online: true });

    await buscar();

    expect(searchRoute).toHaveBeenCalledOnce();
    expect(searchRouteOffline).not.toHaveBeenCalled();
    expect(el.textContent).toContain('18 min');
    expect(el.textContent).toContain('tiempo estimado');
  });

  it('con más de 7 barrios muestra 7 pasos, con el primero y el último (RF-05)', async () => {
    const barrios = Array.from({ length: 12 }, (_, i) => `Barrio ${i + 1}`);
    const rutaLarga: RouteSearchResult = {
      ...conTrazado,
      route: { ...conTrazado.route, neighborhoods: barrios }
    };
    const { buscar, el } = await render({ online: true, searchRoute: () => of(rutaLarga) });

    await buscar();

    const steps = Array.from(el.querySelectorAll('.barrio')).map((n) => n.textContent?.trim());
    expect(steps).toHaveLength(7);
    expect(steps[0]).toBe('Barrio 1');
    expect(steps[6]).toBe('Barrio 12');
  });

  it('muestra la última milla: dónde tomarla y cuánto queda al bajarse', async () => {
    const { buscar, el } = await render({ online: true });

    await buscar();

    expect(el.textContent).toContain('240 m');
    expect(el.textContent).toContain('3 min');
    expect(el.textContent).toContain('90 m');
  });

  it('sin red usa el endpoint offline y NO inventa un tiempo estimado', async () => {
    const { buscar, searchRoute, searchRouteOffline, el } = await render({ online: false });

    await buscar();

    expect(searchRouteOffline).toHaveBeenCalledOnce();
    expect(searchRoute).not.toHaveBeenCalled();
    expect(el.textContent).not.toContain('tiempo estimado');
    expect(el.textContent).toContain('2.4 km');
    expect(el.textContent).toContain('recorrido en buseta');
  });

  it('sin red avisa antes de buscar que no habrá tiempo de viaje', async () => {
    const { el } = await render({ online: false });

    expect(el.textContent).toContain('Estás sin conexión');
  });

  it('si la red falla pese a que el navegador la daba por buena, reintenta sin conexión', async () => {
    // navigator.onLine dice que hay interfaz de red, no que haya internet. Si la
    // llamada no sale de la máquina (status 0), el usuario no tiene por qué ver un
    // error: el endpoint offline no necesita salir a Google.
    const { buscar, searchRouteOffline, el } = await render({
      online: true,
      searchRoute: () => throwError(() => new HttpErrorResponse({ status: 0 }))
    });

    await buscar();

    expect(searchRouteOffline).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('recorrido en buseta');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('una ruta sin trazado se sugiere igual, avisando que no hay punto de abordaje', async () => {
    const { buscar, el } = await render({ online: true, searchRoute: () => of(sinTrazado) });

    await buscar();

    expect(el.textContent).toContain('Camino Real - La Pampa');
    expect(el.textContent).toContain('no tiene su trazado cargado');
  });

  it('con letrero fotografiado en el resultado, lo muestra (criterio de aceptación SCRUM-176)', async () => {
    const { buscar, el } = await render({
      online: true,
      searchRoute: () => of({ ...conTrazado, signs: [letreroArbelaez] })
    });

    await buscar();

    expect(el.textContent).toContain('Letrero de la buseta');
    expect(el.querySelector('app-letrero')).not.toBeNull();
    expect(el.textContent).toContain('ARBELAEZ');
  });

  it('sin evidencia de campo para la ruta sugerida, no muestra la sección del letrero', async () => {
    const { buscar, el } = await render({ online: true });

    await buscar();

    expect(el.textContent).not.toContain('Letrero de la buseta');
    expect(el.querySelector('app-letrero')).toBeNull();
  });

  it('cuando ninguna ruta conecta los barrios muestra el mensaje del backend', async () => {
    const { buscar, el } = await render({
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

    await buscar();

    expect(el.textContent).toContain('No hay rutas disponibles que conecten Centro con Pasca');
  });
});
