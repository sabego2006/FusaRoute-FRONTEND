import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RouteSearchComponent } from './route-search.component';
import { RouteService } from '../../../services/route.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { GoogleMapsLoaderService, MapsStatus } from '../../../core/google-maps-loader.service';
import { GeoJsonLineString, Route, RouteSearchParams, RouteSearchResult } from '../../../models/route.model';
import { FavoriteDestination } from '../../../models/favorite.model';

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
  /** Si hay sesión iniciada; sin ella no se ofrece el favorito (RF-10). */
  loggedIn?: boolean;
  /** Lo que responde `GET /api/users/me/favorite-destination`. */
  getFavoriteDestination?: () => unknown;
  setFavoriteDestination?: () => unknown;
  clearFavoriteDestination?: () => unknown;
  /** Si el formulario se rellena solo tras montar (apaga la precarga del favorito). */
  rellenarFormulario?: boolean;
}

const favoritoLaPampa: FavoriteDestination = {
  destination: 'La Pampa',
  savedAt: '2026-11-04T09:15:00Z',
  congestionSectors: [],
};

/** Mismo favorito, pero con su barrio en franja de trancón ahora mismo (RF-09). */
const favoritoConTranco: FavoriteDestination = {
  ...favoritoLaPampa,
  congestionSectors: [{ name: 'Centro - Carrera 1', startsAt: '17:00:00', endsAt: '19:00:00' }],
};

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

  const getFavoriteDestination = vi.fn(opciones.getFavoriteDestination ?? (() => of(null)));
  const setFavoriteDestination = vi.fn(opciones.setFavoriteDestination ?? (() => of(favoritoLaPampa)));
  const clearFavoriteDestination = vi.fn(opciones.clearFavoriteDestination ?? (() => of(undefined)));

  await TestBed.configureTestingModule({
    imports: [RouteSearchComponent],
    providers: [
      provideRouter([]),
      { provide: RouteService, useValue: { searchRoute, searchRouteOffline, getAllPublicRoutes } },
      { provide: ConnectivityService, useValue: { isOnline: signal(opciones.online ?? true) } },
      { provide: GoogleMapsLoaderService, useValue: mapsLoader },
      {
        provide: UserService,
        useValue: { getFavoriteDestination, setFavoriteDestination, clearFavoriteDestination },
      },
      { provide: AuthService, useValue: { isLoggedIn: signal(opciones.loggedIn ?? false) } },
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(RouteSearchComponent);
  fixture.detectChanges(); // dispara ngOnInit: carga los barrios del catálogo

  // La precarga del favorito solo se puede observar si el formulario queda como lo
  // dejó ngOnInit; los tests de búsqueda sí necesitan el formulario lleno.
  if (opciones.rellenarFormulario ?? true) {
    fixture.componentInstance.searchForm.setValue({
      originNeighborhood: 'Camino Real',
      destinationNeighborhood: 'La Pampa',
    });
  }
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
    getFavoriteDestination,
    setFavoriteDestination,
    clearFavoriteDestination,
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

  it('con letrero, el resultado muestra el SVG de esa ruta (SCRUM-184)', async () => {
    const { triggerSearch, el } = await render({
      online: true,
      searchRoute: () => of({ ...conTrazado, route: { ...conTrazado.route, signFile: 'ARBELAEZ' } })
    });

    await triggerSearch();

    expect(el.textContent).toContain('Letrero de la buseta');
    expect(el.querySelector('app-letrero img')?.getAttribute('src')).toBe('letreros/ARBELAEZ.svg');
  });

  it('sin letrero en la ruta sugerida, no muestra la sección del letrero', async () => {
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

  // --- Destino favorito (RF-10, SCRUM-21) ---

  const estrella = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.fr-boton-favorito');

  it('preloads the destination field with the favorite on open (RF-10)', async () => {
    const { component } = await render({
      loggedIn: true,
      rellenarFormulario: false,
      getFavoriteDestination: () => of(favoritoLaPampa),
    });

    expect(component.searchForm.controls.destinationNeighborhood.value).toBe('La Pampa');
  });

  it('shows the favorite congestion warning without searching (RF-09 within RF-10)', async () => {
    // El criterio pide verlo al abrir la pantalla, sin pulsar "buscar".
    const { el, searchRoute } = await render({
      loggedIn: true,
      rellenarFormulario: false,
      getFavoriteDestination: () => of(favoritoConTranco),
    });

    expect(el.textContent).toContain('Centro - Carrera 1');
    expect(searchRoute).not.toHaveBeenCalled();
  });

  it('hides the favorite warning once there is a result with its own warning', async () => {
    // Dos avisos a la vez dirían dos cosas distintas sobre lo mismo.
    const { el, triggerSearch } = await render({
      loggedIn: true,
      getFavoriteDestination: () => of(favoritoConTranco),
    });
    expect(el.textContent).toContain('Centro - Carrera 1');

    await triggerSearch();

    expect(el.textContent).not.toContain('Centro - Carrera 1');
  });

  it('does not preload if the user already chose a destination', async () => {
    // Pisarle lo que acaba de elegir sería quitarle su decisión.
    const { component } = await render({
      loggedIn: true,
      rellenarFormulario: true,
      getFavoriteDestination: () => of({ ...favoritoLaPampa, destination: 'Camino Real' }),
    });

    expect(component.searchForm.controls.destinationNeighborhood.value).toBe('La Pampa');
  });

  it('does not ask for the favorite without a session', async () => {
    // El favorito vive en la cuenta: pedirlo sin token sería un 401 garantizado.
    const { getFavoriteDestination, el } = await render({ loggedIn: false });

    expect(getFavoriteDestination).not.toHaveBeenCalled();
    expect(estrella(el)).toBeNull();
  });

  it('a failure loading the favorite does not block searching', async () => {
    const { triggerSearch, searchRoute, el } = await render({
      loggedIn: true,
      getFavoriteDestination: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });

    await triggerSearch();

    expect(searchRoute).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('18 min');
  });

  it('marks the chosen destination as favorite', async () => {
    const { el, setFavoriteDestination, fixture } = await render({
      loggedIn: true,
      getFavoriteDestination: () => of(null),
    });

    estrella(el)!.click();
    fixture.detectChanges();

    expect(setFavoriteDestination).toHaveBeenCalledWith('La Pampa');
    expect(estrella(el)!.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking the star again removes the favorite', async () => {
    const { el, clearFavoriteDestination, fixture } = await render({
      loggedIn: true,
      getFavoriteDestination: () => of(favoritoLaPampa),
    });
    expect(estrella(el)!.getAttribute('aria-pressed')).toBe('true');

    estrella(el)!.click();
    fixture.detectChanges();

    expect(clearFavoriteDestination).toHaveBeenCalledOnce();
    expect(estrella(el)!.getAttribute('aria-pressed')).toBe('false');
  });

  it('overwriting the preloaded destination does not change the saved favorite', async () => {
    // Criterio explícito de RF-10: escribir otro destino no toca el favorito.
    const { el, component, setFavoriteDestination, clearFavoriteDestination, fixture } = await render({
      loggedIn: true,
      rellenarFormulario: false,
      getFavoriteDestination: () => of(favoritoLaPampa),
    });

    component.searchForm.controls.destinationNeighborhood.setValue('Camino Real');
    fixture.detectChanges();

    expect(setFavoriteDestination).not.toHaveBeenCalled();
    expect(clearFavoriteDestination).not.toHaveBeenCalled();
    // La estrella se vacía sola: el destino en pantalla ya no es el favorito.
    expect(estrella(el)!.getAttribute('aria-pressed')).toBe('false');
    expect(component.favorite()?.destination).toBe('La Pampa');
  });

  it('the star is disabled while there is no destination chosen', async () => {
    const { el } = await render({
      loggedIn: true,
      rellenarFormulario: false,
      getFavoriteDestination: () => of(null),
    });

    expect(estrella(el)!.disabled).toBe(true);
  });

  it('a failure marking the favorite leaves the button usable again', async () => {
    const { el, component, fixture } = await render({
      loggedIn: true,
      getFavoriteDestination: () => of(null),
      setFavoriteDestination: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });

    estrella(el)!.click();
    fixture.detectChanges();

    expect(component.savingFavorite()).toBe(false);
    expect(estrella(el)!.disabled).toBe(false);
  });

  // --- Repetir una búsqueda del historial (RF-07, SCRUM-82) ---

  /**
   * Como {@link render} pero sin rellenar el formulario a mano y con los parámetros de
   * la URL que pone la pantalla de historial. Así se ve lo que de verdad llega al
   * formulario al repetir una búsqueda.
   */
  async function renderConParametros(
    queryParams: Record<string, string>,
    rutas: Route[] = catalogo,
  ) {
    const getAllPublicRoutes = vi.fn(() => of(rutas));

    await TestBed.configureTestingModule({
      imports: [RouteSearchComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
        {
          provide: RouteService,
          useValue: { searchRoute: vi.fn(() => of(conTrazado)), searchRouteOffline: vi.fn(() => of(sinRed)), getAllPublicRoutes },
        },
        { provide: ConnectivityService, useValue: { isOnline: signal(true) } },
        {
          provide: GoogleMapsLoaderService,
          useValue: { status: signal<MapsStatus>('sin-clave'), load: () => new Promise<void>(() => undefined) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RouteSearchComponent);
    fixture.detectChanges(); // ngOnInit: repone el par y carga los barrios
    return fixture;
  }

  it('repone origen y destino desde la URL al venir del historial', async () => {
    const fixture = await renderConParametros({ origen: 'Camino Real', destino: 'La Pampa' });

    expect(fixture.componentInstance.searchForm.getRawValue()).toEqual({
      originNeighborhood: 'Camino Real',
      destinationNeighborhood: 'La Pampa',
    });
    expect(fixture.componentInstance.searchForm.valid).toBe(true);
  });

  it('repetir no dispara la búsqueda sola: el usuario pulsa buscar', async () => {
    // Buscar es un toque más y el flujo sigue cabiendo en las 4 acciones de RNF-04;
    // buscar automáticamente gastaría una llamada a Google sin que la pidieran.
    const fixture = await renderConParametros({ origen: 'Camino Real', destino: 'La Pampa' });

    expect(fixture.componentInstance.result()).toBeNull();
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('sin parámetros en la URL el formulario queda vacío, como siempre', async () => {
    const fixture = await renderConParametros({});

    expect(fixture.componentInstance.searchForm.getRawValue()).toEqual({
      originNeighborhood: '',
      destinationNeighborhood: '',
    });
  });

  it('un solo parámetro repone solo ese campo', async () => {
    const fixture = await renderConParametros({ destino: 'La Pampa' });

    expect(fixture.componentInstance.searchForm.getRawValue()).toEqual({
      originNeighborhood: '',
      destinationNeighborhood: 'La Pampa',
    });
  });

  it('un barrio que ya no está en el catálogo se limpia en vez de dejar el select en blanco', async () => {
    // Pasa si el barrio se renombró desde aquella búsqueda. Los campos son <select>: un
    // valor sin <option> dejaría el control relleno y la pantalla vacía, y el usuario
    // pulsaría buscar sobre un campo que a él se le ve sin elegir.
    const fixture = await renderConParametros({ origen: 'Barrio Que Ya No Existe', destino: 'La Pampa' });

    expect(fixture.componentInstance.searchForm.getRawValue()).toEqual({
      originNeighborhood: '',
      destinationNeighborhood: 'La Pampa',
    });
  });

  it('el par repuesto llega a la búsqueda cuando el usuario pulsa buscar', async () => {
    const fixture = await renderConParametros({ origen: 'Camino Real', destino: 'La Pampa' });

    fixture.componentInstance.onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.result()).not.toBeNull();
  });
});
