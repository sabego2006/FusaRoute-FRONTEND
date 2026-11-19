import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RouteService } from './route.service';
import { environment } from '../../environments/environment';

describe('RouteService', () => {
  let service: RouteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RouteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el listado al endpoint público del backend y devuelve lo que este responde', () => {
    let result: unknown;
    service.getAllPublicRoutes().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/routes`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, name: 'Ruta', type: 'URBANA', neighborhoods: ['A'], fares: [] }]);

    expect(result).toEqual([{ id: 1, name: 'Ruta', type: 'URBANA', neighborhoods: ['A'], fares: [] }]);
  });

  it('pide el detalle por id', () => {
    service.getRouteById('8').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/api/routes/8`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 8,
      name: 'Ruta',
      type: 'INTERMUNICIPAL',
      neighborhoods: [],
      fares: [],
      lastUpdatedAt: null
    });
  });

  it('la búsqueda con red manda el id del origen y las coordenadas del destino al endpoint online', () => {
    service
      .searchRoute({
        originPlaceId: 12,

        destinationLat: 4.33,
        destinationLng: -74.36
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/api/routes/search`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('originPlaceId')).toBe('12');
    expect(req.request.params.get('destinationLat')).toBe('4.33');
    expect(req.request.params.has('originLat')).toBe(false);
    expect(req.request.params.has('destinationPlaceId')).toBe(false);
    req.flush({ route: {}, estimatedMinutes: 18, travelDistanceInMeters: 2400, boarding: null, dropOff: null });
  });

  it('la búsqueda sin red va a /search/offline, que es otro endpoint', () => {
    let result: unknown;
    service
      .searchRouteOffline({
        originPlaceId: 12,

        destinationLat: 4.33,
        destinationLng: -74.36
      })
      .subscribe((r) => (result = r));

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/api/routes/search/offline`);
    expect(req.request.method).toBe('GET');
    req.flush({ route: {}, estimatedMinutes: null, travelDistanceInMeters: 2400, boarding: null, dropOff: null });

    // Sin red el backend no consulta a Google, así que no manda tiempo estimado.
    expect((result as { estimatedMinutes: number | null }).estimatedMinutes).toBeNull();
  });

  it('propaga el error del backend en vez de inventar datos', () => {
    let status: number | undefined;
    service.getRouteById('999').subscribe({ error: (e) => (status = e.status) });

    http.expectOne(`${environment.apiUrl}/api/routes/999`).flush(null, { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });

  // --- T15 (SCRUM-199) ---

  it('el catálogo se vuelve a pedir si la petición se corta, y entrega el segundo intento', async () => {
    let result: unknown;
    service.getAllPublicRoutes().subscribe((r) => (result = r));

    // Primer intento: la red se cayó a mitad de camino (status 0).
    http.expectOne(`${environment.apiUrl}/api/routes`).error(new ProgressEvent('error'), { status: 0 });

    // La espera del reintento es de 600 ms; vi.waitFor deja pasar el timer real.
    const segundo = await vi.waitFor(() => http.expectOne(`${environment.apiUrl}/api/routes`), { timeout: 3000 });
    segundo.flush([{ id: 1, name: 'Ruta', type: 'URBANA', neighborhoods: [], fares: [] }]);

    expect(result).toHaveLength(1);
  });

  it('un 404 del detalle no se reintenta: el resultado sería el mismo', () => {
    service.getRouteById('999').subscribe({ error: () => undefined });

    http.expectOne(`${environment.apiUrl}/api/routes/999`).flush(null, { status: 404, statusText: 'Not Found' });

    // Si hubiera reintento, http.verify() del afterEach fallaría por la petición pendiente.
    http.expectNone(`${environment.apiUrl}/api/routes/999`);
  });

  it('la búsqueda en línea NO se reintenta sola: cada llamada puede gastar cuota de Google', () => {
    service.searchRoute({ originPlaceId: 99, destinationPlaceId: 128 }).subscribe({ error: () => undefined });

    http.expectOne((r) => r.url === `${environment.apiUrl}/api/routes/search`)
      .error(new ProgressEvent('error'), { status: 0 });

    http.expectNone((r) => r.url === `${environment.apiUrl}/api/routes/search`);
  });

  it('la búsqueda offline sí se reintenta: no consulta a Google', async () => {
    let result: unknown;
    service.searchRouteOffline({ originPlaceId: 99, destinationPlaceId: 128 }).subscribe((r) => (result = r));

    http.expectOne((r) => r.url === `${environment.apiUrl}/api/routes/search/offline`)
      .error(new ProgressEvent('error'), { status: 0 });

    const segundo = await vi.waitFor(
      () => http.expectOne((r) => r.url === `${environment.apiUrl}/api/routes/search/offline`),
      { timeout: 3000 },
    );
    segundo.flush({ route: {}, estimatedMinutes: null });

    expect(result).not.toBeNull();
  });
});
