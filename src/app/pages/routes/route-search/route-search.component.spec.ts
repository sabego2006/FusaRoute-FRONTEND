import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RIDES_STORAGE_KEY } from '../../../services/ride.service';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { GPS_TIMEOUT_MS, RouteSearchComponent } from './route-search.component';
import { RouteService } from '../../../services/route.service';
import { PlaceService } from '../../../services/place.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { GoogleMapsLoaderService } from '../../../core/google-maps-loader.service';
import { RouteSearchParams, RouteSearchResult } from '../../../models/route.model';
import { FavoriteDestination } from '../../../models/favorite.model';
import { MOCK_PLACES } from '../../../core/mock/mock-api.interceptor';

const indio = MOCK_PLACES[0];
const terminal = MOCK_PLACES[4];

const resultado: RouteSearchResult = {
  route: { id: 14, name: 'Centro - Galería - Terminal', type: 'URBANA', neighborhoods: ['Indio', 'Terminal'], fares: [], signFile: null },
  estimatedMinutes: 18,
  etaSource: 'TRAFFIC',
  travelDistanceInMeters: 6115,
  boarding: { latitude: 4.3317, longitude: -74.3775, distanceInMeters: 312, walkingMinutes: 4 },
  dropOff: { latitude: 4.3459, longitude: -74.3779, distanceInMeters: 95, walkingMinutes: 1 },
  longWalk: false,
  congestionSectors: [],
  origin: { lat: 4.3317, lng: -74.3775, label: 'Indio' },
  destination: { lat: 4.3459, lng: -74.3779, label: 'Terminal de Transporte' },
  path: { type: 'LineString', coordinates: [[-74.3775, 4.3317], [-74.3779, 4.3459]] },
  lastUpdatedAt: '2026-02-05',
};

interface Opciones {
  online?: boolean;
  searchRoute?: () => unknown;
  searchRouteOffline?: () => unknown;
  getPlaces?: () => unknown;
  loggedIn?: boolean;
  getFavoriteDestination?: () => unknown;
  query?: Record<string, string>;
  /** Emite cuando "vuelve la red"; por defecto no vuelve nunca. */
  vuelveLaRed?: Subject<void>;
}

async function render(o: Opciones = {}) {
  const searchRoute = vi.fn<(p: RouteSearchParams) => unknown>(o.searchRoute ?? (() => of(resultado)));
  const searchRouteOffline = vi.fn<(p: RouteSearchParams) => unknown>(
    o.searchRouteOffline ?? (() => of({ ...resultado, estimatedMinutes: null, etaSource: null })));
  const getPlaces = vi.fn(o.getPlaces ?? (() => of(MOCK_PLACES)));
  const vuelveLaRed = o.vuelveLaRed ?? new Subject<void>();

  await TestBed.configureTestingModule({
    imports: [RouteSearchComponent],
    providers: [
      provideRouter([]),
      // RideService real: sin sesión guarda en localStorage, que es lo que se prueba aquí.
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(o.query ?? {}) } } },
      { provide: RouteService, useValue: { searchRoute, searchRouteOffline } },
      { provide: PlaceService, useValue: { getPlaces } },
      { provide: ConnectivityService, useValue: {
        isOnline: signal(o.online ?? true),
        whenOnlineAgain: () => vuelveLaRed.asObservable(),
        reconnections: () => vuelveLaRed.asObservable(),
      } },
      { provide: GoogleMapsLoaderService, useValue: { status: signal('sin-clave'), load: () => Promise.reject(new Error('sin-clave')) } },
      { provide: UserService, useValue: {
        getFavoriteDestination: vi.fn(o.getFavoriteDestination ?? (() => of(null))),
        setFavoriteDestination: vi.fn(() => of({ destination: 'Terminal de Transporte', savedAt: '', congestionSectors: [] })),
        clearFavoriteDestination: vi.fn(() => of(undefined)),
      } },
      { provide: AuthService, useValue: { isLoggedIn: signal(o.loggedIn ?? false) } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(RouteSearchComponent);
  fixture.detectChanges();
  const c = fixture.componentInstance;
  const el = fixture.nativeElement as HTMLElement;

  const elegirAmbos = () => {
    c.origin.set({ kind: 'place', place: indio, label: indio.name });
    c.destination.set({ kind: 'place', place: terminal, label: terminal.name });
    fixture.detectChanges();
  };
  const buscar = async () => {
    c.onSubmit();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(c.etaMostrado()).toBe(c.result()?.estimatedMinutes ?? 0);
    }, { timeout: 2000 });
  };
  /** Vuelve a dibujar y deja asentar los efectos; para las pruebas de reintento. */
  const asentar = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const botonPorTexto = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto));
  return { fixture, c, el, searchRoute, searchRouteOffline, getPlaces, vuelveLaRed, elegirAmbos, buscar, asentar, botonPorTexto };
}

function mockGeolocation(impl: (ok: PositionCallback, fail: PositionErrorCallback, opts?: PositionOptions) => void) {
  const getCurrentPosition = vi.fn(impl);
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

describe('RouteSearchComponent', () => {
  it('volverAlFormulario deja el foco en el campo Origen', async () => {
    const { c, el, fixture } = await render();
    // El componente se renderiza fuera del documento: se monta para que document.querySelector lo vea.
    document.body.appendChild(el);
    const origen = el.querySelector<HTMLInputElement>('app-place-combobox input')!;
    origen.scrollIntoView = vi.fn();
    c.volverAlFormulario();
    fixture.detectChanges();
    expect(document.activeElement).toBe(origen);
    el.remove();
  });

  it('reemplaza los select por dos campos escribibles y quita el details', async () => {
    const { el } = await render();
    expect(el.querySelector('select')).toBeNull();
    expect(el.querySelectorAll('input[role="combobox"]').length).toBe(2);
    expect(el.querySelector('details')).toBeNull();
  });

  it('el botón de buscar espera a tener las dos puntas', async () => {
    const { el, c, fixture } = await render();
    const btn = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(btn.disabled).toBe(true);
    c.origin.set({ kind: 'place', place: indio, label: indio.name });
    fixture.detectChanges();
    expect(btn.disabled).toBe(true);
    c.destination.set({ kind: 'place', place: terminal, label: terminal.name });
    fixture.detectChanges();
    expect(btn.disabled).toBe(false);
  });

  it('busca por id de lugar en las dos puntas', async () => {
    const { elegirAmbos, buscar, searchRoute } = await render();
    elegirAmbos();
    await buscar();
    expect(searchRoute).toHaveBeenCalledWith({ originPlaceId: 12, destinationPlaceId: 40 });
  });

  it('Mi ubicación pide el GPS con 8 s y manda lat/lng', async () => {
    const geo = mockGeolocation((ok) => ok({ coords: { latitude: 4.33, longitude: -74.37 } } as GeolocationPosition));
    const { c, fixture, buscar, searchRoute } = await render();
    c.useMyLocation();
    expect(geo.mock.calls[0][2]?.timeout).toBe(GPS_TIMEOUT_MS);
    c.destination.set({ kind: 'place', place: terminal, label: terminal.name });
    fixture.detectChanges();
    await buscar();
    expect(searchRoute).toHaveBeenCalledWith({ originLat: 4.33, originLng: -74.37, destinationPlaceId: 40 });
  });

  it('si niega el GPS lo dice y deja el origen vacío para escribir', async () => {
    mockGeolocation((_ok, fail) => fail({ code: 1 } as GeolocationPositionError));
    const { c, el, fixture } = await render();
    c.useMyLocation();
    fixture.detectChanges();
    expect(c.origin()).toBeNull();
    expect(el.textContent).toContain('No nos dio permiso');
  });

  it('el GPS no se pide en silencio al buscar', async () => {
    const geo = mockGeolocation(() => undefined);
    const { elegirAmbos, buscar } = await render();
    elegirAmbos();
    await buscar();
    expect(geo).not.toHaveBeenCalled();
  });

  it('un punto del mapa en el destino viaja como lat/lng', async () => {
    const { c, fixture, buscar, searchRoute } = await render();
    c.origin.set({ kind: 'place', place: indio, label: indio.name });
    c.onMapPicked({ which: 'destination', point: { lat: 4.34, lng: -74.36 } });
    fixture.detectChanges();
    await buscar();
    expect(searchRoute).toHaveBeenCalledWith({ originPlaceId: 12, destinationLat: 4.34, destinationLng: -74.36 });
  });

  describe('puntas elegidas en el mapa (SCRUM-195)', () => {
    const botones = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).map((b) => b.textContent!.replace(/\s+/g, ' ').trim());

    it('las tres maneras están a la vista sin abrir nada: escribir, mi ubicación y señalar en el mapa', async () => {
      const { el } = await render();
      expect(el.textContent).toContain('¿Desde dónde sale?');
      expect(el.textContent).toContain('¿A dónde va?');
      expect(botones(el).filter((t) => t === 'Señalar en el mapa').length).toBe(2);
      expect(botones(el).filter((t) => t === 'Usar mi ubicación').length).toBe(1);
      expect((el.querySelectorAll('input[role="combobox"]')[1] as HTMLInputElement).placeholder).toContain('Terminal');
    });

    it('se puede buscar con dos puntos del mapa sin escribir nada', async () => {
      const { c, el, fixture, buscar, searchRoute } = await render();
      c.onMapPicked({ which: 'origin', point: { lat: 4.33, lng: -74.37 } });
      c.onMapPicked({ which: 'destination', point: { lat: 4.34, lng: -74.36 } });
      fixture.detectChanges();
      expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
      await buscar();
      expect(searchRoute).toHaveBeenCalledWith({ originLat: 4.33, originLng: -74.37, destinationLat: 4.34, destinationLng: -74.36 });
    });

    it('el punto se muestra como ficha legible, nunca como coordenadas', async () => {
      const { c, el, fixture } = await render();
      c.onMapPicked({ which: 'destination', point: { lat: 4.34123, lng: -74.36456 } });
      fixture.detectChanges();
      expect(el.textContent).toContain('Punto en el mapa');
      expect(el.textContent).not.toMatch(/4\.34|74\.36/);
      expect(botones(el)).toContain('Cambiar');
      expect(el.querySelectorAll('input[role="combobox"]').length).toBe(1);
    });

    it('Quitar devuelve el campo vacío y deshabilita ¡Hágale!; después se puede escribir un lugar', async () => {
      const { c, el, fixture } = await render();
      c.origin.set({ kind: 'place', place: indio, label: indio.name });
      c.onMapPicked({ which: 'destination', point: { lat: 4.34, lng: -74.36 } });
      fixture.detectChanges();
      const submit = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      expect(submit.disabled).toBe(false);
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Quitar')!.click();
      fixture.detectChanges();
      expect(c.destination()).toBeNull();
      expect(submit.disabled).toBe(true);
      expect(el.querySelectorAll('input[role="combobox"]').length).toBe(2);
      c.destination.set({ kind: 'place', place: terminal, label: terminal.name });
      fixture.detectChanges();
      expect(submit.disabled).toBe(false);
    });

    it('cambiar de un punto del mapa a un lugar escrito deja solo el lugar', async () => {
      const { c, fixture, buscar, searchRoute } = await render();
      c.origin.set({ kind: 'place', place: indio, label: indio.name });
      c.onMapPicked({ which: 'destination', point: { lat: 4.34, lng: -74.36 } });
      c.destination.set({ kind: 'place', place: terminal, label: terminal.name });
      fixture.detectChanges();
      await buscar();
      expect(searchRoute).toHaveBeenCalledWith({ originPlaceId: 12, destinationPlaceId: 40 });
    });

    it('"Cambiar" en la ficha del mapa vuelve a abrir el panel; en la del GPS devuelve el campo', async () => {
      const { c, el, fixture } = await render();
      const open = vi.spyOn(c, 'pickOnMap');
      c.onMapPicked({ which: 'destination', point: { lat: 4.34, lng: -74.36 } });
      fixture.detectChanges();
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Cambiar')!.click();
      expect(open).toHaveBeenCalledWith('destination');
      c.origin.set({ kind: 'gps', lat: 4.3, lng: -74.3, label: 'Su ubicación actual' });
      fixture.detectChanges();
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Cambiar')!.click();
      expect(c.origin()).toBeNull();
    });
  });

  it('muestra la vista previa en mapa al elegir un punto, antes de buscar', async () => {
    const { c, el, fixture } = await render();
    expect(el.querySelector('[data-testid="vista-previa"]')).toBeNull();
    c.origin.set({ kind: 'place', place: indio, label: indio.name });
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="vista-previa"]')?.textContent).toContain('Origen: Indio');
  });

  it('rotula el tiempo "con el tráfico de ahora" y la caminata como aprox.', async () => {
    const { el, elegirAmbos, buscar } = await render();
    elegirAmbos();
    await buscar();
    expect(el.querySelector('[data-testid="tiempo"]')?.textContent).toContain('con el tráfico de ahora');
    const caminata = el.querySelector('[data-testid="caminata"]')!.textContent!.replace(/\s+/g, ' ');
    expect(caminata).toContain('aprox. 312 m');
    expect(caminata).toContain('aprox. 95 m');
  });

  it('con etaSource ESTIMATED dice "estimado"', async () => {
    const { el, elegirAmbos, buscar } = await render({ searchRoute: () => of({ ...resultado, etaSource: 'ESTIMATED' }) });
    elegirAmbos();
    await buscar();
    expect(el.querySelector('[data-testid="tiempo"]')?.textContent).toContain('estimado');
  });

  it('el aviso de congestión del resultado va en condicional', async () => {
    const { el, elegirAmbos, buscar } = await render({
      searchRoute: () => of({ ...resultado, congestionSectors: [{ name: 'Indio (tarde)', startsAt: '17:00:00', endsAt: '19:00:00' }] }),
    });
    elegirAmbos();
    await buscar();
    const aviso = el.querySelector('[data-testid="aviso-congestion"]')!.textContent!.toLowerCase();
    expect(aviso).toContain('puede haber');
    expect(aviso).toContain('indio (tarde)');
  });

  it('el módulo "Su viaje" nombra solo los barrios del tramo (SCRUM-198)', async () => {
    // La ruta pasa por cinco barrios; el tramo de esta persona empieza en el tercero.
    const conTramo: RouteSearchResult = {
      ...resultado,
      route: { ...resultado.route, neighborhoods: ['Mirazul', 'San Francisco', 'Indio', 'Cra 7', 'Terminal'] },
      tripSegment: {
        ridePath: { type: 'LineString', coordinates: [[-74.3775, 4.3317], [-74.3779, 4.3459]] },
        neighborhoods: ['Indio', 'Cra 7', 'Terminal'],
        boardingWalk: { bearingDegrees: 45, reference: 'Puente Águila' },
        dropOffWalk: { bearingDegrees: 180, reference: 'Plaza de Mercado' },
      },
    };
    const { el, elegirAmbos, buscar } = await render({ searchRoute: () => of(conTramo) });
    elegirAmbos();
    await buscar();

    const viaje = el.querySelector('[data-testid="caminata"]')!.textContent!.replace(/\s+/g, ' ');
    expect(viaje).toContain('Su viaje');
    expect(viaje).toContain('Pasará por: Indio, Cra 7, Terminal.');
    // Los barrios por los que la buseta ya pasó no aparecen en ninguna parte del módulo.
    expect(viaje).not.toContain('Mirazul');
    expect(viaje).not.toContain('San Francisco');
    // Y ya no existe el módulo que mostraba el recorrido completo de la ruta.
    expect(el.textContent).not.toContain('Por dónde pasa');
  });

  it('avisa la caminata larga', async () => {
    const { el, elegirAmbos, buscar } = await render({ searchRoute: () => of({ ...resultado, longWalk: true }) });
    elegirAmbos();
    await buscar();
    expect(el.textContent).toContain('Le toca caminar más de lo normal');
  });

  it('el mapa del resultado tiene origen, abordaje, bajada y destino', async () => {
    const { c, elegirAmbos, buscar } = await render();
    elegirAmbos();
    await buscar();
    expect(c.resultMarkers().map((m) => m.label)).toEqual(['A', '↑', '↓', 'B']);
  });

  it('el 404 muestra el detalle y la ruta más cercana', async () => {
    const { el, elegirAmbos, buscar } = await render({
      searchRoute: () => throwError(() => new HttpErrorResponse({
        status: 404,
        error: { status: 404, detail: 'No hay rutas.', nearestRoutes: { origin: { routeName: 'Ruta 7', distanceInMeters: 420 } } },
      })),
    });
    elegirAmbos();
    await buscar();
    expect(el.textContent).toContain('No hay rutas.');
    expect(el.textContent).toContain('La ruta más cercana a su origen es Ruta 7, a 420 m');
  });

  it('si la única opción está suspendida, dice cuál ruta y hasta cuándo en hora de Colombia', async () => {
    const { el, elegirAmbos, buscar } = await render({
      searchRoute: () => throwError(() => new HttpErrorResponse({
        status: 404,
        error: {
          status: 404,
          detail: 'No hay rutas disponibles. (texto del servidor)',
          suspendedCandidates: [{ routeId: 12, routeName: 'Centro - Terminal', endsAt: '2026-11-23T01:00:00Z' }],
        },
      })),
    });
    elegirAmbos();
    await buscar();
    expect(el.textContent).toContain('La ruta Centro - Terminal sirve este trayecto, pero está suspendida hasta el');
    expect(el.textContent).toContain('22 de noviembre de 2026');
    expect(el.textContent).toContain('20:00');
    expect(el.textContent).not.toContain('texto del servidor');
  });

  it('sin red usa el endpoint offline', async () => {
    const { elegirAmbos, buscar, searchRoute, searchRouteOffline, el } = await render({ online: false });
    elegirAmbos();
    await buscar();
    expect(searchRoute).not.toHaveBeenCalled();
    expect(searchRouteOffline).toHaveBeenCalled();
    expect(el.textContent).toContain('Sin internet no podemos calcular');
  });

  it('con 503 reintenta por el endpoint offline', async () => {
    const { elegirAmbos, buscar, searchRouteOffline } = await render({
      searchRoute: () => throwError(() => new HttpErrorResponse({ status: 503 })),
    });
    elegirAmbos();
    await buscar();
    expect(searchRouteOffline).toHaveBeenCalled();
  });

  it('repite una búsqueda del historial casando los nombres con los lugares', async () => {
    const { c } = await render({ query: { origen: 'indio', destino: 'Terminal' } });
    expect(c.origin()?.label).toBe('Indio');
    expect(c.destination()?.label).toBe('Terminal de Transporte');
  });

  it('si falla la lista de lugares lo dice', async () => {
    const { el, fixture } = await render({ getPlaces: () => throwError(() => new Error('x')) });
    fixture.detectChanges();
    expect(el.textContent).toContain('No pudimos cargar la lista de lugares');
  });

  // --- T15 (SCRUM-199): con internet lento ningún error es el final del camino ---

  describe('internet lento', () => {
    it('la lista de lugares se puede volver a pedir con el botón, y el combobox queda usable', async () => {
      let intento = 0;
      const { el, asentar, botonPorTexto, getPlaces } = await render({
        getPlaces: () => {
          intento += 1;
          return intento === 1 ? throwError(() => new HttpErrorResponse({ status: 0 })) : of(MOCK_PLACES);
        },
      });
      expect(el.textContent).toContain('No pudimos cargar la lista de lugares');

      botonPorTexto('Reintentar')!.click();
      await asentar();

      expect(getPlaces).toHaveBeenCalledTimes(2);
      expect(el.textContent).not.toContain('No pudimos cargar la lista de lugares');
    });

    it('sin red, los lugares no dicen "no pudimos": dicen que se está esperando, y vuelven solos', async () => {
      const vuelveLaRed = new Subject<void>();
      let intento = 0;
      const { el, asentar, getPlaces, c } = await render({
        online: false,
        vuelveLaRed,
        getPlaces: () => {
          intento += 1;
          return intento === 1 ? throwError(() => new HttpErrorResponse({ status: 0 })) : of(MOCK_PLACES);
        },
      });
      expect(el.textContent).toContain('Apenas vuelva traemos la lista de lugares solos');
      expect(el.textContent).not.toContain('No pudimos cargar la lista de lugares');

      vuelveLaRed.next();
      await asentar();

      expect(getPlaces).toHaveBeenCalledTimes(2);
      expect(c.places().length).toBeGreaterThan(0);
    });

    it('si la búsqueda falla, el error ofrece "Reintentar" y repetirla entrega el resultado', async () => {
      let intento = 0;
      const { el, elegirAmbos, asentar, botonPorTexto, c } = await render({
        searchRoute: () => {
          intento += 1;
          return intento === 1 ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(resultado);
        },
      });
      elegirAmbos();
      c.onSubmit();
      await asentar();
      expect(el.textContent).toContain('No se pudo completar la búsqueda');

      botonPorTexto('Reintentar')!.click();
      await asentar();

      expect(c.result()).not.toBeNull();
      expect(el.textContent).not.toContain('No se pudo completar la búsqueda');
    });

    it('sin red, la búsqueda cortada no dice "no se pudo": espera y se repite sola', async () => {
      const vuelveLaRed = new Subject<void>();
      let intento = 0;
      const { el, elegirAmbos, asentar, c } = await render({
        online: false,
        vuelveLaRed,
        searchRouteOffline: () => {
          intento += 1;
          return intento === 1 ? throwError(() => new HttpErrorResponse({ status: 0 })) : of(resultado);
        },
      });
      elegirAmbos();
      c.onSubmit();
      await asentar();
      expect(el.textContent).toContain('Apenas vuelva, buscamos de nuevo solos');
      expect(el.textContent).not.toContain('No se pudo completar la búsqueda');

      vuelveLaRed.next();
      await asentar();

      expect(c.result()).not.toBeNull();
    });

    it('si tocan "Señalar en el mapa" antes de que baje el selector, queda pendiente y se abre solo al aparecer', async () => {
      const { c, el, fixture } = await render();
      // El selector sale del bundle inicial (@defer): recién renderizada la pantalla aún no está.
      expect(el.querySelector('dialog')).toBeNull();

      c.pickOnMap('origin');
      expect(c.pickPending()).toBe(true);

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
      }, { timeout: 3000 });
      expect(c.pickPending()).toBe(false);
    });

    it('el resultado NO depende del mapa: si Google Maps falla, los pasos y la tarifa igual se ven', async () => {
      const { el, elegirAmbos, buscar } = await render();
      elegirAmbos();
      await buscar();

      // El loader está en 'sin-clave' en estas pruebas, que es el mismo camino que 'error':
      // el mapa se reemplaza por un aviso discreto y el resto de la pantalla sigue.
      expect(el.querySelector('[data-testid="resultado"]')).not.toBeNull();
      expect(el.textContent).toContain('Su viaje');
      expect(el.textContent).toContain('Lo que vale el pasaje');
      expect(el.querySelector('[data-testid="mapa-no-disponible"]')).not.toBeNull();
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });
  });

  it('precarga el destino favorito', async () => {
    const fav: FavoriteDestination = { destination: 'Terminal de Transporte', savedAt: '', congestionSectors: [] };
    const { c } = await render({ loggedIn: true, getFavoriteDestination: () => of(fav) });
    expect(c.destination()?.label).toBe('Terminal de Transporte');
    expect(c.chosenIsFavorite()).toBe(true);
  });

  describe('Ya me subí (P4, sin sesión)', () => {
    afterEach(() => localStorage.clear());

    it('tocar "¡Ya me subí!" guarda el viaje y aparece "Volver a" y el historial', async () => {
      localStorage.clear();
      const { c, el, fixture, elegirAmbos, buscar } = await render();
      expect(el.querySelector('[data-testid="volver-a"]')).toBeNull();
      elegirAmbos();
      await buscar();

      const boton = el.querySelector('[data-testid="ya-me-subi"]') as HTMLButtonElement;
      expect(boton.textContent).toContain('¡Ya me subí!');
      boton.click();
      fixture.detectChanges();

      expect(boton.textContent).toContain('✓ ¡Buen viaje!');
      expect(el.querySelector('[data-testid="volver-a"]')?.textContent).toContain('Volver a: Terminal de Transporte');
      expect(el.querySelector('[data-testid="ultimos-viajes"]')?.textContent).toContain('Terminal de Transporte');
      const guardado = JSON.parse(localStorage.getItem(RIDES_STORAGE_KEY)!);
      expect(guardado[0]).toMatchObject({ routeId: 14, destinationPlaceId: terminal.id, originLabel: indio.name });
      expect(c.lastRide()?.destinationLabel).toBe('Terminal de Transporte');
    });

    it('el atajo llena solo el destino, con el lugar de la lista', async () => {
      localStorage.setItem(RIDES_STORAGE_KEY, JSON.stringify([{
        id: 1, routeId: 14, routeName: 'R', signFile: null, destinationLabel: terminal.name,
        destinationPlaceId: terminal.id, destinationLat: terminal.lat, destinationLng: terminal.lng,
        originLabel: 'Indio', boardedAt: new Date().toISOString(),
      }]));
      const { c, el, fixture } = await render();
      fixture.detectChanges();

      (el.querySelector('[data-testid="volver-a"]') as HTMLButtonElement).click();
      expect(c.destination()).toMatchObject({ kind: 'place', place: { id: terminal.id } });
      expect(c.origin()).toBeNull();
    });

    it('un viaje a un punto del mapa vuelve como punto del mapa', async () => {
      const { c } = await render();
      c.useRideDestination({ id: 2, routeId: 14, routeName: 'R', signFile: null, destinationLabel: 'Punto',
        destinationPlaceId: null, destinationLat: 4.33, destinationLng: -74.36, originLabel: 'x', boardedAt: '' });
      expect(c.destination()).toEqual({ kind: 'map', lat: 4.33, lng: -74.36, label: 'Punto' });
    });
  });
});
