import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RouteSearchComponent } from './route-search.component';
import { RouteService } from '../../../services/route.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { GoogleMapsLoaderService, MapsStatus } from '../../../core/google-maps-loader.service';
import { GeoJsonLineString, Route, RouteSearchParams, RouteSearchResult, RouteSign } from '../../../models/route.model';

const catalogo: Route[] = [
  {
    id: 4,
    name: 'Camino Real - La Pampa',
    type: 'URBANA',
    neighborhoods: ['Camino Real', 'La Pampa'],
    fares: [{ referencePoint: null, amount: 2600, validFrom: '2026-02-05' }]
  },
];

const conTrazado: RouteSearchResult = {
  route: catalogo[0],
  estimatedMinutes: 18,
  travelDistanceInMeters: 2400,
  boarding: { latitude: 4.343, longitude: -74.3658, distanceInMeters: 240, walkingMinutes: 3 },
  dropOff: { latitude: 4.33, longitude: -74.3602, distanceInMeters: 90, walkingMinutes: 1 },
  lastUpdatedAt: '2026-02-05',
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
  mapsStatus?: MapsStatus;
  searchRoute?: () => unknown;
  searchRouteOffline?: () => unknown;
  getAllPublicRoutes?: () => unknown;
}

const trazadoCaminoReal: GeoJsonLineString = {
  type: 'LineString',
  coordinates: [[-74.3661, 4.3433], [-74.3600, 4.3300]]
};
/** Como {@link conTrazado} pero con el `path` del backend ya incluido. */
const conTrazadoYMapa: RouteSearchResult = { ...conTrazado, path: trazadoCaminoReal };

async function render(opciones: Opciones) {
  const searchRoute = vi.fn<(params: RouteSearchParams) => unknown>(opciones.searchRoute ?? (() => of(conTrazado)));
  const searchRouteOffline = vi.fn<(params: RouteSearchParams) => unknown>(
    opciones.searchRouteOffline ?? (() => of(sinRed)),
  );
  const getAllPublicRoutes = vi.fn(opciones.getAllPublicRoutes ?? (() => of(catalogo)));
  const mapsLoader = {
    status: signal<MapsStatus>(opciones.mapsStatus ?? 'sin-clave'),
    load: () => new Promise<void>(() => undefined),
  };

  await TestBed.configureTestingModule({
    imports: [RouteSearchComponent],
    providers: [
      provideRouter([]),
      { provide: RouteService, useValue: { searchRoute, searchRouteOffline, getAllPublicRoutes } },
      { provide: ConnectivityService, useValue: { isOnline: signal(opciones.online ?? true) } },
      { provide: GoogleMapsLoaderService, useValue: mapsLoader },
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
    component: fixture.componentInstance,
    fixture,
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

  it('shows the fare of the suggested route (RF-06)', async () => {
    const { triggerSearch, el } = await render({ online: true });

    await triggerSearch();

    expect(el.textContent).toMatch(/\$\s?2\.600/);
    expect(el.textContent).toContain('5 de febrero de 2026');
  });

  it('intermunicipal: shows the fare table ordered by the backend, not reordered here', async () => {
    const intermunicipal: RouteSearchResult = {
      ...conTrazado,
      route: {
        ...conTrazado.route,
        type: 'INTERMUNICIPAL',
        fares: [
          { referencePoint: 'Corregimiento', amount: 3000, validFrom: '2025-01-16' },
          { referencePoint: 'Alaska', amount: 3550, validFrom: '2026-02-05' },
          { referencePoint: 'Pasca', amount: 4300, validFrom: '2025-01-16' }
        ]
      }
    };
    const { triggerSearch, el } = await render({ online: true, searchRoute: () => of(intermunicipal) });

    await triggerSearch();

    const rows = Array.from(el.querySelectorAll('tbody tr')).map((r) => r.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Corregimiento');
    expect(rows[1]).toContain('Alaska');
    expect(rows[2]).toContain('Pasca');
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

  // --- Mapa en el resultado, selector de punto, degradación 503 ---

  it('con trazado, pinta el mapa en el resultado reusando MapViewComponent', async () => {
    // Sin clave de Maps aquí a propósito: MapViewComponent muestra su propio aviso en
    // ese caso y no intenta renderizar <google-map> (eso rompe en jsdom, que no trae el
    // namespace google). Lo que valida este test es que la sección se cablee cuando
    // viene `path`, no que Google pinte.
    const { triggerSearch, el } = await render({
      online: true,
      searchRoute: () => of(conTrazadoYMapa),
    });

    await triggerSearch();

    expect(el.textContent).toContain('Recorrido en el mapa');
    expect(el.querySelector('app-map-view')).not.toBeNull();
  });

  it('sin trazado, no muestra la sección del mapa', async () => {
    const sinPath: RouteSearchResult = { ...conTrazadoYMapa, path: null };
    const { triggerSearch, el } = await render({ online: true, searchRoute: () => of(sinPath) });

    await triggerSearch();

    expect(el.textContent).not.toContain('Recorrido en el mapa');
    expect(el.querySelector('app-map-view')).toBeNull();
  });

  it('online con tiempo null (degradación), muestra el texto online y no el de "sin conexión"', async () => {
    // Fase 1 del backend: si Google falla, el online responde sin tiempo. No es lo
    // mismo que "sin conexión" y no debe mentirle al usuario.
    const degradado: RouteSearchResult = { ...conTrazadoYMapa, estimatedMinutes: null };
    const { triggerSearch, el } = await render({ online: true, searchRoute: () => of(degradado) });

    await triggerSearch();

    expect(el.textContent).toContain('No pudimos calcular el tiempo ahora');
    expect(el.textContent).not.toContain('Sin conexión no podemos calcular');
  });

  it('un 503 del endpoint online dispara el reintento offline', async () => {
    // Cubre un backend viejo todavía desplegado que propaga el fallo de Google como
    // 503. El front degrada por su cuenta sin mostrar error.
    const { triggerSearch, searchRouteOffline, el } = await render({
      online: true,
      searchRoute: () => throwError(() => new HttpErrorResponse({ status: 503 })),
    });

    await triggerSearch();

    expect(searchRouteOffline).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('recorrido en buseta');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('con destino fijado en el mapa, los params llevan lat/lng del destino', async () => {
    const { triggerSearch, searchRoute, component } = await render({ online: true });

    component.onPickedPointsChange({ origin: null, destination: { lat: 4.33, lng: -74.36 } });
    await triggerSearch();

    const params = searchRoute.mock.calls[0][0];
    expect(params.destinationLat).toBe(4.33);
    expect(params.destinationLng).toBe(-74.36);
  });

  it('sin puntos fijados, los params no llevan destinationLat/Lng', async () => {
    const { triggerSearch, searchRoute } = await render({ online: true });

    await triggerSearch();

    const params = searchRoute.mock.calls[0][0];
    expect(params.destinationLat).toBeUndefined();
    expect(params.destinationLng).toBeUndefined();
  });

  it('un origen fijado en el mapa pisa a la geolocalización del navegador', async () => {
    const geoCall = vi.fn<GetCurrentPosition>();
    stubGeolocation(geoCall);
    const { triggerSearch, searchRoute, component } = await render({ online: true });

    component.onPickedPointsChange({ origin: { lat: 4.3400, lng: -74.3650 }, destination: null });
    await triggerSearch();

    expect(geoCall).not.toHaveBeenCalled();
    const params = searchRoute.mock.calls[0][0];
    expect(params.originLat).toBe(4.3400);
    expect(params.originLng).toBe(-74.3650);
  });

  it('el enlace al detalle de la ruta sugerida apunta a /rutas/{id}', async () => {
    const { triggerSearch, el } = await render({ online: true, searchRoute: () => of(conTrazadoYMapa) });

    await triggerSearch();

    const link = el.querySelector<HTMLAnchorElement>('a[href="/rutas/4"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('Ver detalle de la ruta');
  });
});
