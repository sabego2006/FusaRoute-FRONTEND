import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RouteSearchComponent } from './route-search.component';
import { RouteService } from '../../../services/route.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { Route, RouteSearchParams, RouteSearchResult } from '../../../models/route.model';

const catalogo: Route[] = [
  { id: 4, name: 'Camino Real - La Pampa', type: 'URBANA', neighborhoods: ['Camino Real', 'La Pampa'], fares: [] },
];

const conTrazado: RouteSearchResult = {
  route: catalogo[0],
  estimatedMinutes: 18,
  travelDistanceInMeters: 2400,
  boarding: { latitude: 4.343, longitude: -74.3658, distanceInMeters: 240, walkingMinutes: 3 },
  dropOff: { latitude: 4.33, longitude: -74.3602, distanceInMeters: 90, walkingMinutes: 1 }
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
  getAllPublicRoutes?: () => unknown;
}

async function render(opciones: Opciones) {
  const searchRoute = vi.fn<(params: RouteSearchParams) => unknown>(opciones.searchRoute ?? (() => of(conTrazado)));
  const searchRouteOffline = vi.fn<(params: RouteSearchParams) => unknown>(
    opciones.searchRouteOffline ?? (() => of(sinRed)),
  );
  const getAllPublicRoutes = vi.fn(opciones.getAllPublicRoutes ?? (() => of(catalogo)));

  await TestBed.configureTestingModule({
    imports: [RouteSearchComponent],
    providers: [
      { provide: RouteService, useValue: { searchRoute, searchRouteOffline, getAllPublicRoutes } },
      { provide: ConnectivityService, useValue: { isOnline: signal(opciones.online ?? true) } }
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(RouteSearchComponent);
  fixture.detectChanges(); // dispara ngOnInit: carga los barrios del catálogo

  fixture.componentInstance.searchForm.setValue({
    originNeighborhood: 'Camino Real',
    destinationNeighborhood: 'La Pampa',
  });
  fixture.detectChanges();

  const triggerSearch = async () => {
    fixture.componentInstance.onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  return {
    triggerSearch,
    searchRoute,
    searchRouteOffline,
    getAllPublicRoutes,
    el: fixture.nativeElement as HTMLElement,
  };
}

type GetCurrentPosition = (
  success: PositionCallback,
  error?: PositionErrorCallback,
) => void;

/** Instala navigator.geolocation para una prueba y la retira al terminar. */
function stubGeolocation(getCurrentPosition: GetCurrentPosition) {
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
}

describe('RouteSearchComponent', () => {
  afterEach(() => {
    // jsdom no trae geolocation por defecto; se retira lo que cada prueba instaló.
    delete (navigator as unknown as Record<string, unknown>)['geolocation'];
  });

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

  // --- SCRUM-130: selectores de barrio y geolocalización opcional del origen ---

  it('puebla los selectores de origen y destino con los barrios del catálogo', async () => {
    const { el } = await render({ online: true });

    const opciones = Array.from(el.querySelector('#origin')?.querySelectorAll('option') ?? [])
      .map((o) => o.textContent?.trim())
      .filter((text) => text !== 'Elige tu barrio de salida');

    expect(opciones).toEqual(['Camino Real', 'La Pampa']);
  });

  it('si el catálogo de barrios no carga, lo avisa sin bloquear el formulario', async () => {
    const { el } = await render({ online: true, getAllPublicRoutes: () => throwError(() => new Error('red caída')) });

    expect(el.textContent).toContain('No pudimos cargar la lista de barrios');
  });

  it('en línea, usa la geolocalización concedida para afinar el origen', async () => {
    stubGeolocation((success) =>
      success({ coords: { latitude: 4.3433, longitude: -74.3661 } } as GeolocationPosition));
    const { triggerSearch, searchRoute } = await render({ online: true });

    await triggerSearch();

    const params = searchRoute.mock.calls[0][0];
    expect(params.originLat).toBe(4.3433);
    expect(params.originLng).toBe(-74.3661);
    // Nunca hay geolocalización del destino de otra persona.
    expect(params.destinationLat).toBeUndefined();
    expect(params.destinationLng).toBeUndefined();
  });

  it('si el usuario niega la ubicación, busca igual sin coordenadas', async () => {
    stubGeolocation((_success, error) => error?.({ code: 1 } as GeolocationPositionError));
    const { triggerSearch, searchRoute, el } = await render({ online: true });

    await triggerSearch();

    const params = searchRoute.mock.calls[0][0];
    expect(params.originLat).toBeUndefined();
    expect(el.textContent).toContain('18 min');
  });

  it('sin soporte de geolocalización en el navegador, busca igual sin coordenadas', async () => {
    // jsdom no define navigator.geolocation por defecto: este es justo ese caso.
    const { triggerSearch, searchRoute } = await render({ online: true });

    await triggerSearch();

    const params = searchRoute.mock.calls[0][0];
    expect(params.originLat).toBeUndefined();
  });

  it('sin conexión nunca pide la ubicación', async () => {
    const getCurrentPosition = vi.fn<GetCurrentPosition>();
    stubGeolocation(getCurrentPosition);
    const { triggerSearch } = await render({ online: false });

    await triggerSearch();

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
